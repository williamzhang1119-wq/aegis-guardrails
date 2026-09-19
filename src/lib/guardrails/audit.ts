import { createHash } from "node:crypto";
import type { GuardAction, GuardrailReport, HarmCategory, Severity } from "./types";

export interface AuditEntry {
  id: string;
  at: number;
  sessionId: string;
  /** Session identifiers are hashed too — the raw id never reaches the log. */
  sessionHash: string;
  phase: "input" | "output";
  action: GuardAction;
  severity: Severity;
  categories: HarmCategory[];
  /** Content fingerprint. Enough to correlate duplicates, not to reconstruct. */
  contentHash: string;
  contentLength: number;
  redactionCount: number;
  durationMs: number;
  /** Only populated when privacy-preserving mode is off. */
  preview?: string;
}

const RING_SIZE = 200;
const entries: AuditEntry[] = [];
let counter = 0;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Records a guardrail decision.
 *
 * Safety logs are a privacy liability: the most sensitive messages a user ever
 * sends are exactly the ones a naive implementation writes to disk in full. By
 * default this stores hashes, lengths, and verdicts — enough to audit the
 * pipeline's behaviour, tune thresholds, and spot abuse patterns, without
 * retaining the message. Turning that off is a visible, deliberate choice.
 */
export function recordAudit(
  report: GuardrailReport,
  options: { sessionId: string; content: string; privacyPreserving: boolean },
): AuditEntry {
  counter += 1;
  const entry: AuditEntry = {
    id: `audit_${counter}`,
    at: Date.now(),
    sessionId: options.sessionId,
    sessionHash: hash(options.sessionId),
    phase: report.phase,
    action: report.action,
    severity: report.severity,
    categories: report.checks.map((check) => check.category),
    contentHash: hash(options.content),
    contentLength: options.content.length,
    redactionCount: report.redactions.length,
    durationMs: report.totalDurationMs,
    preview: options.privacyPreserving ? undefined : options.content.slice(0, 120),
  };

  entries.push(entry);
  if (entries.length > RING_SIZE) entries.splice(0, entries.length - RING_SIZE);
  return entry;
}

export function readAudit(sessionId?: string): AuditEntry[] {
  const scoped = sessionId ? entries.filter((entry) => entry.sessionId === sessionId) : entries;
  return [...scoped].reverse();
}

export function auditSummary(sessionId?: string) {
  const scoped = readAudit(sessionId);
  const byAction: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const entry of scoped) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
    for (const category of new Set(entry.categories)) {
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    }
  }

  const durations = scoped.map((entry) => entry.durationMs).sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] ?? durations.at(-1) : 0;

  return {
    total: scoped.length,
    byAction,
    byCategory,
    p95DurationMs: Number((p95 ?? 0).toFixed(2)),
  };
}

export function clearAudit(): void {
  entries.length = 0;
}
