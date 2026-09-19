import type { CheckResult, GuardPhase, GuardrailContext, Redaction } from "../types";
import { severityFromScore } from "../types";

interface SecretRule {
  type: string;
  label: string;
  re: RegExp;
  weight: number;
}

/**
 * High-precision credential patterns. These are intentionally shaped around
 * known token formats rather than generic entropy, because an entropy heuristic
 * shreds ordinary code snippets, hashes, and base64 images.
 */
const SECRET_RULES: SecretRule[] = [
  { type: "openai_key", label: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, weight: 1 },
  { type: "anthropic_key", label: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, weight: 1 },
  { type: "github_token", label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, weight: 1 },
  { type: "aws_access_key", label: "AWS access key ID", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, weight: 1 },
  { type: "google_api_key", label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, weight: 1 },
  { type: "slack_token", label: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, weight: 1 },
  { type: "stripe_key", label: "Stripe secret key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g, weight: 1 },
  {
    type: "private_key",
    label: "Private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    weight: 1,
  },
  { type: "jwt", label: "JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, weight: 0.8 },
  {
    type: "assigned_secret",
    label: "Secret assigned in text",
    re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[^\s"',;]{8,}/gi,
    weight: 0.7,
  },
];

export interface SecretFinding {
  type: string;
  label: string;
  start: number;
  end: number;
  value: string;
  weight: number;
}

export function findSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rule of SECRET_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      findings.push({
        type: rule.type,
        label: rule.label,
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        weight: rule.weight,
      });
    }
  }

  findings.sort((a, b) => a.start - b.start || b.weight - a.weight);
  const kept: SecretFinding[] = [];
  for (const finding of findings) {
    if (!kept.some((other) => finding.start < other.end && other.start < finding.end)) {
      kept.push(finding);
    }
  }
  return kept;
}

export function redactSecrets(text: string): { text: string; redactions: Redaction[]; findings: SecretFinding[] } {
  const findings = findSecrets(text);
  if (findings.length === 0) return { text, redactions: [], findings };

  const redactions: Redaction[] = [];
  let output = "";
  let cursor = 0;
  let index = 0;

  for (const finding of [...findings].sort((a, b) => a.start - b.start)) {
    index += 1;
    const placeholder = `[REDACTED_SECRET_${index}]`;
    output += text.slice(cursor, finding.start) + placeholder;
    cursor = finding.end;
    redactions.push({
      type: finding.type,
      placeholder,
      hint: `${finding.label}, ${finding.value.length} characters`,
    });
  }
  output += text.slice(cursor);

  return { text: output, redactions, findings };
}

export function secretCheck(text: string, ctx: GuardrailContext, phase: GuardPhase): CheckResult | null {
  const started = performance.now();
  const policy = ctx.policy.categories.secret_leak;
  if (!policy.enabled) return null;

  const { text: redacted, redactions, findings } = redactSecrets(text);
  if (findings.length === 0) return null;

  const score = Math.min(1, Math.max(...findings.map((f) => f.weight)));
  // Inbound secrets are the user's own mistake and can be scrubbed. Outbound
  // secrets mean the model is spreading a credential, which is not recoverable
  // by redaction alone — the response is withheld.
  const action = phase === "output" ? "block" : "redact";

  return {
    checkId: "secret_leak",
    title: "Credentials & secrets",
    category: "secret_leak",
    phase,
    severity: severityFromScore(score),
    action: score >= policy.threshold ? action : "annotate",
    score,
    rationale:
      phase === "output"
        ? `The draft response contained ${findings.length} credential-shaped value(s). The response was withheld rather than redacted, since emitting a key at all is the failure.`
        : `Found ${findings.length} credential-shaped value(s) and scrubbed them before the model saw the text. Rotate anything real that was pasted here.`,
    evidence: findings.slice(0, 6).map((finding) => ({
      label: finding.label,
      excerpt: `${finding.value.slice(0, 4)}… (${finding.value.length} chars)`,
      weight: finding.weight,
    })),
    transformed: phase === "input" ? redacted : undefined,
    redactions: phase === "input" ? redactions : undefined,
    durationMs: performance.now() - started,
  };
}
