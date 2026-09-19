import type {
  CategoryPolicy,
  GuardAction,
  HarmCategory,
  Policy,
  PolicyOverrides,
} from "./types";

export interface CategoryMeta {
  id: HarmCategory;
  title: string;
  /** What this category is for, in reviewer-facing language. */
  description: string;
  /** Why the default action is what it is. */
  reasoning: string;
  group: "harm" | "integrity" | "privacy" | "abuse";
}

/**
 * The category taxonomy. This is the part of the system a policy owner reads
 * first, so each entry states plainly what it covers and how it responds.
 */
export const CATEGORY_META: Record<HarmCategory, CategoryMeta> = {
  csae: {
    id: "csae",
    title: "Child sexual abuse & exploitation",
    description: "Any sexualisation of minors, in any framing, fictional or otherwise.",
    reasoning:
      "Zero tolerance: blocked at the lowest threshold in the policy, and the threshold cannot be raised. The only exemptions are narrow protective ones — sex education, safeguarding, and reporting.",
    group: "harm",
  },
  self_harm: {
    id: "self_harm",
    title: "Self-harm & suicide",
    description: "Suicidal intent, self-injury methods, or encouragement of either.",
    reasoning:
      "Never a bare refusal. Crisis language triggers a safe completion that acknowledges the person and surfaces help lines.",
    group: "harm",
  },
  weapons_mass_harm: {
    id: "weapons_mass_harm",
    title: "Weapons of mass harm",
    description: "Synthesis or deployment of chemical, biological, radiological, or nuclear agents.",
    reasoning: "Uplift risk is severe and irreversible, so operational detail is blocked outright.",
    group: "harm",
  },
  violence_threat: {
    id: "violence_threat",
    title: "Violence & credible threats",
    description: "Planning violence against real people, or threats aimed at an identifiable target.",
    reasoning: "Blocks targeted planning while leaving discussion of violence in the abstract alone.",
    group: "harm",
  },
  cyber_intrusion: {
    id: "cyber_intrusion",
    title: "Cyber intrusion",
    description: "Working malware, ransomware, exploit code, or intrusion against systems you do not own.",
    reasoning:
      "Defensive security, CTFs, and code review are explicitly mitigated so the assistant stays useful to engineers.",
    group: "harm",
  },
  illicit_drugs: {
    id: "illicit_drugs",
    title: "Illicit drug manufacture",
    description: "Synthesis routes, precursor sourcing, or trafficking logistics.",
    reasoning: "Harm reduction, pharmacology, and policy questions are allowed; production detail is not.",
    group: "harm",
  },
  dangerous_medical: {
    id: "dangerous_medical",
    title: "Dangerous medical instruction",
    description: "Specific dosing, drug interactions, or self-treatment guidance that could injure someone.",
    reasoning: "Answers are allowed with a care-seeking disclaimer rather than blocked.",
    group: "harm",
  },
  hate_harassment: {
    id: "hate_harassment",
    title: "Hate & harassment",
    description: "Dehumanising content or harassment directed at people or protected groups.",
    reasoning: "Blocks generation of hateful content; still permits discussion and study of it.",
    group: "abuse",
  },
  extremism: {
    id: "extremism",
    title: "Violent extremism",
    description: "Promotion of, or recruitment for, violent extremist movements.",
    reasoning: "Blocks propaganda and recruitment material; journalism and research are mitigated.",
    group: "abuse",
  },
  fraud_deception: {
    id: "fraud_deception",
    title: "Fraud & deception",
    description: "Phishing kits, scam scripts, forged documents, or mass deceptive campaigns.",
    reasoning: "Blocks ready-to-use deception assets; fraud awareness and detection are allowed.",
    group: "abuse",
  },
  adult_sexual: {
    id: "adult_sexual",
    title: "Explicit sexual content",
    description: "Graphic sexual material involving adults.",
    reasoning: "Annotated rather than blocked — a deployment decision, not a safety floor.",
    group: "abuse",
  },
  privacy_doxxing: {
    id: "privacy_doxxing",
    title: "Doxxing & surveillance",
    description: "Locating, identifying, or covertly tracking a specific private individual.",
    reasoning: "Blocks targeting of private people; public-figure facts and OSINT theory are allowed.",
    group: "privacy",
  },
  pii: {
    id: "pii",
    title: "Personal data",
    description: "Emails, phone numbers, government IDs, and payment card numbers.",
    reasoning:
      "Redacted in place so the turn still succeeds. Card numbers are Luhn-validated to keep false positives down.",
    group: "privacy",
  },
  secret_leak: {
    id: "secret_leak",
    title: "Credentials & secrets",
    description: "API keys, tokens, and private keys pasted in or emitted by the model.",
    reasoning: "Redacted on the way in and blocked on the way out, since echoing a key spreads it.",
    group: "privacy",
  },
  prompt_injection: {
    id: "prompt_injection",
    title: "Prompt injection & jailbreak",
    description: "Attempts to override the system prompt, adopt an unsafe persona, or smuggle instructions.",
    reasoning:
      "Detected and neutralised rather than blocked: the text is quarantined as untrusted data and the turn continues.",
    group: "integrity",
  },
  system_prompt_leak: {
    id: "system_prompt_leak",
    title: "System prompt disclosure",
    description: "Model output that reproduces its own instructions verbatim.",
    reasoning: "Output-side only. Leaking instructions hands an attacker the map of the defences.",
    group: "integrity",
  },
  regulated_advice: {
    id: "regulated_advice",
    title: "Regulated advice",
    description: "Legal, medical, or financial questions that call for a licensed professional.",
    reasoning: "Answered with context and a disclaimer. Refusing here would be unhelpful, not safe.",
    group: "integrity",
  },
  rate_limit: {
    id: "rate_limit",
    title: "Rate limit",
    description: "Per-session request budget.",
    reasoning: "Caps automated abuse and runaway cost before any model call happens.",
    group: "integrity",
  },
  input_size: {
    id: "input_size",
    title: "Input size",
    description: "Per-message and per-conversation character budgets.",
    reasoning: "Oversized inputs are a common vector for context stuffing and injection payloads.",
    group: "integrity",
  },
};

function cat(threshold: number, maxAction: GuardAction, enabled = true): CategoryPolicy {
  return { enabled, threshold, maxAction };
}

/**
 * Default policy. Thresholds are the dial to turn when tuning: lower catches
 * more and costs more false positives, higher is the reverse.
 */
export const DEFAULT_POLICY: Policy = {
  id: "default",
  version: "1.0.0",
  categories: {
    csae: cat(0.01, "block"),
    self_harm: cat(0.3, "safe_complete"),
    weapons_mass_harm: cat(0.35, "block"),
    violence_threat: cat(0.45, "block"),
    cyber_intrusion: cat(0.5, "block"),
    illicit_drugs: cat(0.45, "block"),
    dangerous_medical: cat(0.4, "annotate"),
    hate_harassment: cat(0.45, "block"),
    extremism: cat(0.45, "block"),
    fraud_deception: cat(0.45, "block"),
    adult_sexual: cat(0.55, "annotate"),
    privacy_doxxing: cat(0.45, "block"),
    pii: cat(0.3, "redact"),
    secret_leak: cat(0.3, "redact"),
    prompt_injection: cat(0.4, "redact"),
    system_prompt_leak: cat(0.4, "block"),
    regulated_advice: cat(0.4, "annotate"),
    rate_limit: cat(0.99, "block"),
    input_size: cat(0.99, "block"),
  },
  limits: {
    maxCharsPerMessage: 8_000,
    maxCharsPerConversation: 60_000,
    requestsPerWindow: 20,
    windowMs: 60_000,
  },
  redactPii: true,
  streamingGuard: true,
  privacyPreservingAudit: true,
};

/**
 * Categories a deployment may not weaken. Overrides that touch these are
 * ignored, so a UI toggle can never turn the floor off.
 */
export const NON_NEGOTIABLE: HarmCategory[] = ["csae", "weapons_mass_harm", "self_harm"];

export function resolvePolicy(overrides?: PolicyOverrides): Policy {
  if (!overrides) return DEFAULT_POLICY;

  const categories = { ...DEFAULT_POLICY.categories };
  for (const [key, patch] of Object.entries(overrides.categories ?? {})) {
    const id = key as HarmCategory;
    if (!categories[id]) continue;
    if (NON_NEGOTIABLE.includes(id)) continue;
    categories[id] = { ...categories[id], ...patch };
  }

  const limits = { ...DEFAULT_POLICY.limits, ...overrides.limits };
  // Clamp so a client cannot hand itself an unlimited budget.
  limits.maxCharsPerMessage = Math.min(Math.max(limits.maxCharsPerMessage, 1), 32_000);
  limits.requestsPerWindow = Math.min(Math.max(limits.requestsPerWindow, 1), 120);

  return {
    ...DEFAULT_POLICY,
    id: "custom",
    categories,
    limits,
    redactPii: overrides.redactPii ?? DEFAULT_POLICY.redactPii,
    streamingGuard: overrides.streamingGuard ?? DEFAULT_POLICY.streamingGuard,
    privacyPreservingAudit:
      overrides.privacyPreservingAudit ?? DEFAULT_POLICY.privacyPreservingAudit,
  };
}
