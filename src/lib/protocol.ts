import type { GuardrailReport, PolicyOverrides } from "@/lib/guardrails/types";
import type { ProviderInfo } from "@/lib/model/provider";
import type { ChatTurn } from "@/lib/model/types";

export interface ChatRequestBody {
  messages: ChatTurn[];
  policy?: PolicyOverrides;
}

/**
 * Newline-delimited JSON events. Chosen over SSE because the client needs to
 * receive structured guardrail reports interleaved with text deltas, and
 * because a `replace` event has to be able to retract text already displayed.
 */
export type ChatEvent =
  | { type: "provider"; provider: ProviderInfo }
  | { type: "input_report"; report: GuardrailReport }
  | { type: "delta"; text: string }
  /** Discard whatever has been rendered and show this instead. */
  | { type: "replace"; text: string; reason: string }
  | { type: "output_report"; report: GuardrailReport }
  | { type: "notice"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function encodeEvent(event: ChatEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export function decodeEvents(buffer: string): { events: ChatEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as ChatEvent);
    } catch {
      // Partial frame; the caller keeps the remainder and retries next read.
    }
  }
  return { events, rest };
}

export const SESSION_HEADER = "x-venture-session";
