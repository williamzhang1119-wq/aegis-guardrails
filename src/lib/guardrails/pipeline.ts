import { classify } from "./checks/classifier";
import { inputSizeCheck, rateLimitCheck } from "./checks/limits";
import { piiCheck } from "./checks/pii";
import { promptInjectionCheck } from "./checks/prompt-injection";
import { secretCheck } from "./checks/secrets";
import { systemPromptLeakCheck } from "./checks/system-prompt-leak";
import { buildDisclaimers, buildResponseOverride } from "./responses";
import type { CheckResult, GuardrailContext, GuardrailReport, HarmCategory, Redaction } from "./types";
import { maxAction, maxSeverity } from "./types";

function emptyReport(phase: "input" | "output", text: string): GuardrailReport {
  return {
    phase,
    action: "allow",
    severity: "none",
    text,
    checks: [],
    redactions: [],
    triggeredCategories: [],
    totalDurationMs: 0,
  };
}

/**
 * Folds a list of check results into a single decision.
 *
 * Two rules govern this and nothing else is allowed to override them: the
 * strongest action requested by any check wins, and transformations are applied
 * in the order the checks ran so later checks see the already-sanitised text.
 */
function merge(
  phase: "input" | "output",
  originalText: string,
  checks: CheckResult[],
  startedAt: number,
): GuardrailReport {
  let action: GuardrailReport["action"] = "allow";
  let severity: GuardrailReport["severity"] = "none";
  let text = originalText;
  const redactions: Redaction[] = [];
  const triggered = new Set<HarmCategory>();

  for (const check of checks) {
    action = maxAction(action, check.action);
    severity = maxSeverity(severity, check.severity);
    if (check.action !== "allow" && check.action !== "annotate") triggered.add(check.category);
    if (check.transformed !== undefined) text = check.transformed;
    if (check.redactions) redactions.push(...check.redactions);
  }

  const report: GuardrailReport = {
    phase,
    action,
    severity,
    text,
    checks,
    redactions,
    triggeredCategories: [...triggered],
    totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
  };

  report.responseOverride = buildResponseOverride(report);
  return report;
}

/**
 * Input pipeline. Order matters:
 *
 *  1. Rate limit and size, because they are free and stop abuse before any
 *     model call is made.
 *  2. Injection detection, which strips invisible characters and quarantines
 *     override attempts. Running it early means the classifier scores text that
 *     has already had its obfuscation removed.
 *  3. Secret and PII redaction, so the model never receives the raw values.
 *  4. Harm classification, on the sanitised text.
 */
export function runInputGuardrails(rawText: string, ctx: GuardrailContext): GuardrailReport {
  const startedAt = performance.now();
  const checks: CheckResult[] = [];

  const gate = [rateLimitCheck(rawText, ctx), inputSizeCheck(rawText, ctx)].filter(
    (check): check is CheckResult => check !== null,
  );
  if (gate.length > 0) {
    // A blocked gate short-circuits: there is no reason to classify a message
    // that will not be sent, and doing so would burn CPU on abusive traffic.
    return merge("input", rawText, gate, startedAt);
  }

  let text = rawText;

  const injection = promptInjectionCheck(text, ctx);
  if (injection) {
    checks.push(injection);
    if (injection.transformed !== undefined) text = injection.transformed;
  }

  const secrets = secretCheck(text, ctx, "input");
  if (secrets) {
    checks.push(secrets);
    if (secrets.transformed !== undefined) text = secrets.transformed;
  }

  const pii = piiCheck(text, ctx, "input");
  if (pii) {
    checks.push(pii);
    if (pii.transformed !== undefined) text = pii.transformed;
  }

  checks.push(...classify(text, ctx, "input"));

  const report = merge("input", rawText, checks, startedAt);
  // `merge` replays transformations from the check list, which is the same
  // sanitised text computed above; keep them in sync explicitly.
  report.text = text;
  return report;
}

/**
 * Output pipeline. The model is treated as untrusted: its draft goes through
 * the same taxonomy as user input, plus two output-only checks.
 */
export function runOutputGuardrails(draft: string, ctx: GuardrailContext): GuardrailReport {
  const startedAt = performance.now();
  const checks: CheckResult[] = [];

  const leak = systemPromptLeakCheck(draft, ctx);
  if (leak) checks.push(leak);

  const secrets = secretCheck(draft, ctx, "output");
  if (secrets) checks.push(secrets);

  const pii = piiCheck(draft, ctx, "output");
  if (pii) checks.push(pii);

  checks.push(...classify(draft, ctx, "output"));

  const report = merge("output", draft, checks, startedAt);

  if (report.action === "redact") {
    // On the output side a redaction is applied to what the user sees.
    const applied = checks.find((check) => check.transformed !== undefined);
    if (applied?.transformed) report.text = applied.transformed;
  }

  return report;
}

export function disclaimersFor(report: GuardrailReport): string[] {
  const annotated = report.checks
    .filter((check) => check.action === "annotate" && check.score >= 0.4)
    .map((check) => check.category);
  return buildDisclaimers(annotated);
}

export { emptyReport };
