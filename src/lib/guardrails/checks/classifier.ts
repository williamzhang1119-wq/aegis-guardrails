import { CATEGORY_META } from "../policy";
import {
  CATEGORY_RULES,
  DELIVERY_SIGNALS,
  MENTION_ONLY_FACTOR,
  OUTPUT_META,
  type CategoryRule,
} from "../rules";
import { matchPatterns, scoreCategory, type ScoredMatch } from "../scoring";
import type { CheckResult, GuardPhase, GuardrailContext } from "../types";
import { clampAction, severityFromScore } from "../types";

/**
 * Re-scores a category for the output phase.
 *
 * The input rules are tuned for requests, and applying them unchanged to model
 * output produces absurd results: an answer explaining how ransomware spreads
 * scores as if it were ransomware. Output is judged on whether it *delivers*
 * the harm — sequenced instructions, quantities, a payload — rather than on
 * whether it names the topic. A bare mention is heavily discounted, and copy
 * that is refusing or explaining the safety system is discounted further.
 *
 * Child safety is exempt: there is no framing in which that content is a mere
 * mention, so its score is never reduced.
 */
function adjustForOutput(rule: CategoryRule, text: string, scored: ScoredMatch): ScoredMatch {
  if (rule.id === "csae") return scored;

  const delivery = matchPatterns(text, DELIVERY_SIGNALS);
  const meta = matchPatterns(text, OUTPUT_META);
  const mitigated = [...scored.mitigated, ...meta.evidence.map((item) => item.label)];

  if (delivery.total === 0) {
    return {
      score: Math.max(0, scored.score * MENTION_ONLY_FACTOR - meta.total),
      evidence: scored.evidence,
      mitigated,
    };
  }

  return {
    score: Math.max(0, Math.min(1, scored.score + delivery.total - meta.total)),
    evidence: [...scored.evidence, ...delivery.evidence],
    mitigated,
  };
}

/**
 * Runs the category taxonomy over a piece of text.
 *
 * Both phases share one rule set on purpose. A model that emits a synthesis
 * route is exactly as much of a problem as a user who asks for one, and a
 * single taxonomy means there is no gap between what is refused on the way in
 * and what is caught on the way out.
 */
export function classify(text: string, ctx: GuardrailContext, phase: GuardPhase): CheckResult[] {
  const results: CheckResult[] = [];

  for (const rule of CATEGORY_RULES) {
    if (rule.phases && !rule.phases.includes(phase)) continue;
    const policy = ctx.policy.categories[rule.id];
    if (!policy?.enabled) continue;

    const started = performance.now();
    const raw = scoreCategory(text, rule);
    if (raw.score === 0) continue;

    const scored = phase === "output" ? adjustForOutput(rule, text, raw) : raw;
    if (scored.score === 0) continue;

    const meta = CATEGORY_META[rule.id];
    const overThreshold = scored.score >= policy.threshold;
    const action = overThreshold ? clampAction(rule.action, policy.maxAction) : "annotate";

    results.push({
      checkId: `category:${rule.id}`,
      title: meta.title,
      category: rule.id,
      phase,
      severity: severityFromScore(scored.score),
      action,
      score: Number(scored.score.toFixed(3)),
      rationale: buildRationale(rule, scored.score, policy.threshold, scored.mitigated, phase),
      evidence: scored.evidence.slice(0, 6),
      mitigated: scored.mitigated,
      durationMs: performance.now() - started,
    });
  }

  return results;
}

function buildRationale(
  rule: CategoryRule,
  score: number,
  threshold: number,
  mitigated: string[],
  phase: GuardPhase,
): string {
  const subject = phase === "input" ? "The message" : "The draft response";
  const scoreText = `scored ${score.toFixed(2)} against a threshold of ${threshold.toFixed(2)}`;

  if (score < threshold) {
    const because = mitigated.length
      ? ` Benign context lowered it: ${mitigated.join(", ").toLowerCase()}.`
      : "";
    return `${subject} touched this category but ${scoreText}, so it was allowed through and logged.${because}`;
  }

  const because = mitigated.length
    ? ` Benign context was found (${mitigated.join(", ").toLowerCase()}) but not enough to clear the threshold.`
    : "";

  switch (rule.action) {
    case "safe_complete":
      return `${subject} ${scoreText}. Responding with a supportive safe completion and crisis resources instead of the requested content.${because}`;
    case "annotate":
      return `${subject} ${scoreText}. Answering, with a disclaimer attached.${because}`;
    default:
      return `${subject} ${scoreText}, so the request for operational detail was declined.${because}`;
  }
}
