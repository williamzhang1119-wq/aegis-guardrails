import { SAFETY_PRINCIPLES, SYSTEM_PROMPT_CANARY } from "@/lib/model/system-prompt";
import type { CheckResult, GuardrailContext } from "../types";
import { severityFromScore } from "../types";

/**
 * Distinctive phrases from the system prompt. A canary alone is easy to strip,
 * so the check also looks for the prompt's own wording and for the shape of a
 * model reciting its rules.
 */
const LEAK_PHRASES: { label: string; needle: string; weight: number }[] = [
  { label: "Internal directive id", needle: SYSTEM_PROMPT_CANARY.toLowerCase(), weight: 1 },
  { label: "Operating rules header", needle: "operating rules:", weight: 0.6 },
  { label: "Identity line", needle: "you are venture 1", weight: 0.6 },
  { label: "Response style directive", needle: "response style: direct, warm", weight: 0.7 },
  ...SAFETY_PRINCIPLES.map((principle) => ({
    label: `Principle: ${principle.title}`,
    needle: principle.body.slice(0, 40).toLowerCase(),
    weight: 0.5,
  })),
];

const RECITATION_PATTERNS: { label: string; re: RegExp; weight: number }[] = [
  {
    label: "Announces it is quoting its instructions",
    re: /\b(?:here (?:is|are) my (?:system )?(?:prompt|instructions|rules)|my (?:system )?(?:prompt|instructions) (?:is|are|say)|as instructed by my system prompt|my full instructions are)\b/i,
    weight: 0.7,
  },
  {
    label: "Numbered rule recitation",
    re: /(?:^|\n)\s*\d\.\s+(?:never|do not|always|you must)\b[\s\S]{0,120}(?:\n\s*\d\.\s+(?:never|do not|always|you must)\b)/i,
    weight: 0.5,
  },
];

export function systemPromptLeakCheck(text: string, ctx: GuardrailContext): CheckResult | null {
  const started = performance.now();
  const policy = ctx.policy.categories.system_prompt_leak;
  if (!policy.enabled) return null;

  const haystack = text.toLowerCase();
  const evidence: CheckResult["evidence"] = [];
  let score = 0;

  for (const phrase of LEAK_PHRASES) {
    if (!haystack.includes(phrase.needle)) continue;
    score += phrase.weight;
    evidence.push({ label: phrase.label, excerpt: "matched internal wording", weight: phrase.weight });
  }

  for (const pattern of RECITATION_PATTERNS) {
    if (!pattern.re.test(text)) continue;
    score += pattern.weight;
    evidence.push({ label: pattern.label, excerpt: "structure of a rule dump", weight: pattern.weight });
  }

  if (score === 0) return null;
  score = Math.min(1, score);

  return {
    checkId: "system_prompt_leak",
    title: "System prompt disclosure",
    category: "system_prompt_leak",
    phase: "output",
    severity: severityFromScore(score),
    action: score >= policy.threshold ? "block" : "annotate",
    score: Number(score.toFixed(3)),
    rationale:
      score >= policy.threshold
        ? "The draft response reproduced the assistant's own operating instructions. It was withheld, because publishing the rules hands an attacker a map of the defences."
        : "Faint resemblance to the internal instructions. Allowed through and logged.",
    evidence: evidence.slice(0, 6),
    durationMs: performance.now() - started,
  };
}
