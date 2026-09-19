/**
 * Core vocabulary for the guardrail system.
 *
 * The whole pipeline is built around one idea: every check returns a
 * `CheckResult`, results are merged into a `GuardrailReport`, and the report
 * decides what happens to the turn. Nothing else in the app is allowed to make
 * a safety decision on its own.
 */

export const SEVERITY_ORDER = ["none", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

/**
 * What the pipeline is allowed to do about a finding, from least to most
 * restrictive. The merged report always takes the strongest action requested by
 * any single check.
 */
export const ACTION_ORDER = ["allow", "annotate", "redact", "safe_complete", "block"] as const;
export type GuardAction = (typeof ACTION_ORDER)[number];

export type GuardPhase = "input" | "output";

export type HarmCategory =
  | "self_harm"
  | "violence_threat"
  | "weapons_mass_harm"
  | "cyber_intrusion"
  | "illicit_drugs"
  | "csae"
  | "adult_sexual"
  | "hate_harassment"
  | "privacy_doxxing"
  | "fraud_deception"
  | "dangerous_medical"
  | "extremism"
  | "prompt_injection"
  | "pii"
  | "secret_leak"
  | "system_prompt_leak"
  | "rate_limit"
  | "input_size"
  | "regulated_advice";

/** A single piece of evidence, kept short so it is safe to show in a UI. */
export interface Evidence {
  /** Human-readable name of the pattern that fired. */
  label: string;
  /** Redacted excerpt of the matched span. */
  excerpt: string;
  weight: number;
}

export interface Redaction {
  type: string;
  placeholder: string;
  /** Never the raw value — only enough to recognise what was removed. */
  hint: string;
}

export interface CheckResult {
  checkId: string;
  /** Display name for the inspector panel. */
  title: string;
  category: HarmCategory;
  phase: GuardPhase;
  severity: Severity;
  action: GuardAction;
  /** Normalised 0..1 confidence that the category applies. */
  score: number;
  /** One sentence explaining the decision, written for a human reviewer. */
  rationale: string;
  evidence: Evidence[];
  /** Set when the check rewrote the text (redaction, neutralisation). */
  transformed?: string;
  /** Placeholders substituted by a transforming check. */
  redactions?: Redaction[];
  /** Populated when benign-context mitigators lowered the score. */
  mitigated?: string[];
  durationMs: number;
}

export interface GuardrailReport {
  phase: GuardPhase;
  action: GuardAction;
  severity: Severity;
  /** Text after every transforming check has run, in pipeline order. */
  text: string;
  checks: CheckResult[];
  redactions: Redaction[];
  /** Categories that drove the final action. */
  triggeredCategories: HarmCategory[];
  /** Refusal or safe-completion copy, when the action calls for one. */
  responseOverride?: string;
  totalDurationMs: number;
}

export interface GuardrailContext {
  sessionId: string;
  policy: Policy;
  /** Prior turns, used by checks that need conversational context. */
  history: { role: "user" | "assistant"; content: string }[];
  now: number;
}

/** Per-category tuning. Everything a reviewer would want to change lives here. */
export interface CategoryPolicy {
  enabled: boolean;
  /** Score at or above which the category's action is taken. */
  threshold: number;
  /** Ceiling for how aggressive this category may be. */
  maxAction: GuardAction;
}

export interface Policy {
  id: string;
  version: string;
  categories: Record<HarmCategory, CategoryPolicy>;
  limits: {
    maxCharsPerMessage: number;
    maxCharsPerConversation: number;
    requestsPerWindow: number;
    windowMs: number;
  };
  /** Redact PII instead of blocking, so ordinary requests still get answers. */
  redactPii: boolean;
  /** Hold back streamed tokens until the output guard has seen them. */
  streamingGuard: boolean;
  /** Log hashes and verdicts rather than message bodies. */
  privacyPreservingAudit: boolean;
}

export type PolicyOverrides = Partial<{
  categories: Partial<Record<HarmCategory, Partial<CategoryPolicy>>>;
  limits: Partial<Policy["limits"]>;
  redactPii: boolean;
  streamingGuard: boolean;
  privacyPreservingAudit: boolean;
}>;

export type Check = (
  text: string,
  ctx: GuardrailContext,
) => CheckResult | null | Promise<CheckResult | null>;

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

export function maxAction(a: GuardAction, b: GuardAction): GuardAction {
  return ACTION_ORDER.indexOf(a) >= ACTION_ORDER.indexOf(b) ? a : b;
}

export function clampAction(action: GuardAction, ceiling: GuardAction): GuardAction {
  return ACTION_ORDER.indexOf(action) <= ACTION_ORDER.indexOf(ceiling) ? action : ceiling;
}

export function severityFromScore(score: number): Severity {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "medium";
  if (score > 0) return "low";
  return "none";
}
