import type { CheckResult, GuardrailContext } from "../types";

interface Bucket {
  hits: number[];
}

/**
 * Per-session sliding window, held in module scope.
 *
 * This is deliberately simple and deliberately per-instance: it stops a single
 * tab from hammering the endpoint, and it is the right shape for a real limiter
 * without pretending to be one. A multi-instance deployment needs shared state
 * (Redis, Upstash, or the platform's own limiter) — see README.
 */
const buckets = new Map<string, Bucket>();

const MAX_TRACKED_SESSIONS = 5_000;

export interface RateLimitState {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function checkRateLimit(
  sessionId: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitState {
  if (buckets.size > MAX_TRACKED_SESSIONS) buckets.clear();

  const bucket = buckets.get(sessionId) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(sessionId, bucket);
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, remaining: 0, resetInMs: Math.max(0, windowMs - (now - oldest)) };
  }

  bucket.hits.push(now);
  buckets.set(sessionId, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    resetInMs: windowMs,
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimitCheck(_text: string, ctx: GuardrailContext): CheckResult | null {
  const started = performance.now();
  const policy = ctx.policy.categories.rate_limit;
  if (!policy.enabled) return null;

  const { requestsPerWindow, windowMs } = ctx.policy.limits;
  const state = checkRateLimit(ctx.sessionId, requestsPerWindow, windowMs, ctx.now);
  if (state.allowed) return null;

  const seconds = Math.ceil(state.resetInMs / 1000);
  return {
    checkId: "rate_limit",
    title: "Rate limit",
    category: "rate_limit",
    phase: "input",
    severity: "medium",
    action: "block",
    score: 1,
    rationale: `This session used its budget of ${requestsPerWindow} messages per ${Math.round(windowMs / 1000)}s. Retry in about ${seconds}s.`,
    evidence: [
      {
        label: "Session budget exhausted",
        excerpt: `${requestsPerWindow} requests / ${Math.round(windowMs / 1000)}s`,
        weight: 1,
      },
    ],
    durationMs: performance.now() - started,
  };
}

export function inputSizeCheck(text: string, ctx: GuardrailContext): CheckResult | null {
  const started = performance.now();
  const policy = ctx.policy.categories.input_size;
  if (!policy.enabled) return null;

  const { maxCharsPerMessage, maxCharsPerConversation } = ctx.policy.limits;
  const historyChars = ctx.history.reduce((total, turn) => total + turn.content.length, 0);
  const conversationChars = historyChars + text.length;

  const messageOver = text.length > maxCharsPerMessage;
  const conversationOver = conversationChars > maxCharsPerConversation;
  if (!messageOver && !conversationOver) return null;

  return {
    checkId: "input_size",
    title: "Input size",
    category: "input_size",
    phase: "input",
    severity: "low",
    action: "block",
    score: 1,
    rationale: messageOver
      ? `Message is ${text.length} characters, over the ${maxCharsPerMessage} character limit. Oversized inputs are a common way to bury injected instructions in noise.`
      : `Conversation reached ${conversationChars} characters, over the ${maxCharsPerConversation} character budget. Start a new conversation to continue.`,
    evidence: [
      {
        label: messageOver ? "Message too long" : "Conversation budget exceeded",
        excerpt: messageOver
          ? `${text.length} / ${maxCharsPerMessage} chars`
          : `${conversationChars} / ${maxCharsPerConversation} chars`,
        weight: 1,
      },
    ],
    durationMs: performance.now() - started,
  };
}
