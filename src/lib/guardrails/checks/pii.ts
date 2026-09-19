import type { CheckResult, GuardPhase, GuardrailContext, Redaction } from "../types";
import { severityFromScore } from "../types";

interface PiiRule {
  type: string;
  label: string;
  re: RegExp;
  /** Extra test to suppress structurally-similar but harmless matches. */
  validate?: (match: string) => boolean;
  weight: number;
}

/** Luhn checksum. Filters order numbers and random digit runs out of card hits. */
export function luhn(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = clean.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const PII_RULES: PiiRule[] = [
  {
    type: "email",
    label: "Email address",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    weight: 0.5,
  },
  {
    type: "payment_card",
    label: "Payment card number",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhn,
    weight: 0.9,
  },
  {
    type: "government_id",
    label: "Government ID (US SSN format)",
    re: /\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g,
    weight: 0.9,
  },
  {
    type: "phone",
    label: "Phone number",
    re: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?|\d{2,4}[ .-])\d{3,4}[ .-]?\d{3,4}\b/g,
    // Guard against version strings, dates, and IDs that look like numbers.
    validate: (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) return false;
      return !/^(19|20)\d{6}$/.test(digits);
    },
    weight: 0.5,
  },
  {
    type: "iban",
    label: "Bank account (IBAN)",
    re: /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}\b/g,
    weight: 0.8,
  },
  {
    type: "ip_address",
    label: "IP address",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    // Loopback and RFC1918 space is not personal data worth redacting.
    validate: (match) =>
      !/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|255\.)/.test(match),
    weight: 0.35,
  },
  {
    type: "street_address",
    label: "Street address",
    re: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b\.?/g,
    weight: 0.6,
  },
  {
    type: "date_of_birth",
    label: "Date of birth",
    re: /\b(?:date of birth|dob|born on)\b[:\s]*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/gi,
    weight: 0.7,
  },
];

export interface PiiFinding {
  type: string;
  label: string;
  start: number;
  end: number;
  value: string;
  weight: number;
}

export function findPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];

  for (const rule of PII_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (rule.validate && !rule.validate(match[0])) continue;
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

  // Overlapping matches are common (a card number also looks like a phone
  // number). Keep the highest-weight finding for any given span.
  findings.sort((a, b) => a.start - b.start || b.weight - a.weight);
  const kept: PiiFinding[] = [];
  for (const finding of findings) {
    const overlaps = kept.some((other) => finding.start < other.end && other.start < finding.end);
    if (!overlaps) kept.push(finding);
  }
  return kept;
}

/** Shows the shape of what was removed without revealing the value itself. */
function hintFor(finding: PiiFinding): string {
  if (finding.type === "email") {
    const [, domain] = finding.value.split("@");
    return `…@${domain ?? "unknown"}`;
  }
  const digits = finding.value.replace(/\D/g, "");
  if (digits.length >= 4) return `ends in ${digits.slice(-4)}`;
  return `${finding.value.length} characters`;
}

export function redactPii(text: string): { text: string; redactions: Redaction[]; findings: PiiFinding[] } {
  const findings = findPii(text);
  if (findings.length === 0) return { text, redactions: [], findings };

  const counters = new Map<string, number>();
  const redactions: Redaction[] = [];
  let output = "";
  let cursor = 0;

  for (const finding of [...findings].sort((a, b) => a.start - b.start)) {
    const index = (counters.get(finding.type) ?? 0) + 1;
    counters.set(finding.type, index);
    const placeholder = `[REDACTED_${finding.type.toUpperCase()}_${index}]`;
    output += text.slice(cursor, finding.start) + placeholder;
    cursor = finding.end;
    redactions.push({ type: finding.type, placeholder, hint: hintFor(finding) });
  }
  output += text.slice(cursor);

  return { text: output, redactions, findings };
}

export function piiCheck(text: string, ctx: GuardrailContext, phase: GuardPhase): CheckResult | null {
  const started = performance.now();
  const policy = ctx.policy.categories.pii;
  if (!policy.enabled) return null;

  const { text: redacted, redactions, findings } = redactPii(text);
  if (findings.length === 0) return null;

  const score = Math.min(1, Math.max(...findings.map((f) => f.weight)));
  const willRedact = ctx.policy.redactPii;

  return {
    checkId: "pii",
    title: "Personal data",
    category: "pii",
    phase,
    severity: severityFromScore(score),
    action: score >= policy.threshold ? (willRedact ? "redact" : "block") : "annotate",
    score,
    rationale: willRedact
      ? `Found ${findings.length} item(s) of personal data and replaced them with placeholders before the model saw the text.`
      : `Found ${findings.length} item(s) of personal data. Redaction is disabled in this policy, so the turn is blocked instead.`,
    evidence: findings.slice(0, 6).map((finding) => ({
      label: finding.label,
      excerpt: hintFor(finding),
      weight: finding.weight,
    })),
    transformed: willRedact ? redacted : undefined,
    redactions: willRedact ? redactions : undefined,
    durationMs: performance.now() - started,
  };
}
