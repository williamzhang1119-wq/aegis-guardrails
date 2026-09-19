import { runOutputGuardrails } from "./pipeline";
import type { GuardrailContext, GuardrailReport } from "./types";

export interface StreamStep {
  /** Text that is cleared for display. */
  emit: string;
  /** Set when the stream must be abandoned and replaced. */
  abort?: GuardrailReport;
}

/**
 * Output guard for streamed generation.
 *
 * Streaming and output filtering are in genuine tension: you cannot unsay a
 * token the user has already read. Two mechanisms handle that here.
 *
 * 1. **Holdback.** The tail of the buffer is withheld from display until more
 *    text arrives. A violation that completes inside the tail is caught before
 *    any of it is shown.
 * 2. **Retraction.** Every scan runs against the entire accumulated draft, not
 *    just the newest chunk, so a pattern spanning a chunk boundary is still
 *    found. If a blocking violation appears after text was already released,
 *    the guard aborts and the client discards the whole partial message.
 *
 * The cost is latency: the user sees output `holdback` characters behind the
 * model. Set `streamingGuard: false` in the policy to trade that safety for
 * responsiveness and see the difference.
 */
export class StreamingOutputGuard {
  private buffer = "";
  private emitted = 0;
  private aborted = false;

  constructor(
    private readonly ctx: GuardrailContext,
    private readonly holdback = 280,
  ) {}

  push(chunk: string): StreamStep {
    if (this.aborted) return { emit: "" };
    this.buffer += chunk;

    if (!this.ctx.policy.streamingGuard) {
      const emit = this.buffer.slice(this.emitted);
      this.emitted = this.buffer.length;
      return { emit };
    }

    const report = runOutputGuardrails(this.buffer, this.ctx);
    if (report.action === "block" || report.action === "safe_complete") {
      this.aborted = true;
      return { emit: "", abort: report };
    }

    const safeUpTo = Math.max(this.emitted, this.buffer.length - this.holdback);
    const emit = this.buffer.slice(this.emitted, safeUpTo);
    this.emitted = safeUpTo;
    return { emit };
  }

  /** Final scan over the complete draft, which is the authoritative verdict. */
  finish(): { emit: string; report: GuardrailReport } {
    const report = runOutputGuardrails(this.buffer, this.ctx);

    if (this.aborted || report.action === "block" || report.action === "safe_complete") {
      return { emit: "", report };
    }

    // A redacting output check rewrites the text, so the tail cannot simply be
    // appended — the client is told to replace the message with `report.text`.
    if (report.action === "redact") {
      return { emit: "", report };
    }

    const emit = this.buffer.slice(this.emitted);
    this.emitted = this.buffer.length;
    return { emit, report };
  }

  get draft(): string {
    return this.buffer;
  }

  get releasedLength(): number {
    return this.emitted;
  }
}
