import type { Evidence } from "./types";

export interface Pattern {
  label: string;
  re: RegExp;
  weight: number;
}

export interface ScoredMatch {
  score: number;
  evidence: Evidence[];
  mitigated: string[];
}

const MAX_EXCERPT = 60;

/**
 * Trims a matched span to something short enough to display and strips
 * anything that looks like a token or long number, so evidence shown in the UI
 * can never itself become a leak.
 */
export function safeExcerpt(match: string): string {
  const collapsed = match.replace(/\s+/g, " ").trim();
  const defanged = collapsed
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[long-token]")
    .replace(/\b\d{9,}\b/g, "[long-number]");
  return defanged.length > MAX_EXCERPT ? `${defanged.slice(0, MAX_EXCERPT)}…` : defanged;
}

export function matchPatterns(
  text: string,
  patterns: Pattern[],
): { total: number; evidence: Evidence[] } {
  let total = 0;
  const evidence: Evidence[] = [];

  for (const pattern of patterns) {
    // Patterns are authored with /g so a single rule can report several hits,
    // but each rule contributes its weight at most once to keep scores bounded.
    const re = new RegExp(pattern.re.source, pattern.re.flags.includes("g") ? pattern.re.flags : `${pattern.re.flags}g`);
    const match = re.exec(text);
    if (!match) continue;
    total += pattern.weight;
    evidence.push({
      label: pattern.label,
      excerpt: safeExcerpt(match[0]),
      weight: pattern.weight,
    });
  }

  return { total, evidence };
}

/**
 * The scoring model, deliberately simple so its decisions stay explainable:
 *
 *  1. Topic triggers establish that the category is even in play. No trigger,
 *     no score — intensifiers alone never convict.
 *  2. Intensifiers raise the score when the request looks operational
 *     ("step by step", "give me the code") rather than curious.
 *  3. Mitigators lower it when there is credible benign context
 *     ("how do I protect against", "is this legal", "for my class").
 *
 * Every contribution is reported as evidence, which is what makes the
 * inspector panel in the UI possible.
 */
export function scoreCategory(
  text: string,
  rules: { triggers: Pattern[]; intensifiers?: Pattern[]; mitigators?: Pattern[] },
): ScoredMatch {
  const triggers = matchPatterns(text, rules.triggers);
  if (triggers.total === 0) {
    return { score: 0, evidence: [], mitigated: [] };
  }

  const intensifiers = matchPatterns(text, rules.intensifiers ?? []);
  const mitigators = matchPatterns(text, rules.mitigators ?? []);

  const raw = triggers.total + intensifiers.total - mitigators.total;
  const score = Math.max(0, Math.min(1, raw));

  return {
    score,
    evidence: [...triggers.evidence, ...intensifiers.evidence],
    mitigated: mitigators.evidence.map((item) => item.label),
  };
}
