import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/guardrails/audit";
import { disclaimersFor, runInputGuardrails } from "@/lib/guardrails/pipeline";
import { resolvePolicy } from "@/lib/guardrails/policy";
import { StreamingOutputGuard } from "@/lib/guardrails/streaming";
import type { GuardrailContext } from "@/lib/guardrails/types";
import { describeProvider, selectProvider } from "@/lib/model/provider";
import { SYSTEM_PROMPT } from "@/lib/model/system-prompt";
import type { ChatTurn } from "@/lib/model/types";
import { encodeEvent, SESSION_HEADER, type ChatEvent, type ChatRequestBody } from "@/lib/protocol";

export const runtime = "nodejs";
/** Guardrail decisions must be computed per request, never cached. */
export const dynamic = "force-dynamic";

const MAX_HISTORY_TURNS = 12;

function sessionIdFrom(request: Request): string {
  const header = request.headers.get(SESSION_HEADER);
  if (header && /^[A-Za-z0-9_-]{6,64}$/.test(header)) return header;
  // Fall back to a coarse network identifier so the rate limiter still has a
  // key for clients that do not send one.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `anon_${forwarded || "local"}`;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const turns: ChatTurn[] = incoming
    .filter(
      (turn): turn is ChatTurn =>
        !!turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string",
    )
    .slice(-MAX_HISTORY_TURNS);

  const latest = turns.at(-1);
  if (!latest || latest.role !== "user" || latest.content.trim().length === 0) {
    return NextResponse.json({ error: "The last message must be a non-empty user turn." }, { status: 400 });
  }

  const policy = resolvePolicy(body.policy);
  const sessionId = sessionIdFrom(request);
  const ctx: GuardrailContext = {
    sessionId,
    policy,
    history: turns.slice(0, -1),
    now: Date.now(),
  };

  const provider = selectProvider();
  const providerInfo = describeProvider(provider);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encodeEvent(event));

      try {
        send({ type: "provider", provider: providerInfo });

        const inputReport = runInputGuardrails(latest.content, ctx);
        recordAudit(inputReport, {
          sessionId,
          content: latest.content,
          privacyPreserving: policy.privacyPreservingAudit,
        });
        send({ type: "input_report", report: inputReport });

        // A blocked or safe-completed input never reaches the model. The
        // response is written copy from the policy, not generated text.
        if (inputReport.action === "block" || inputReport.action === "safe_complete") {
          send({
            type: "replace",
            text: inputReport.responseOverride ?? "I can't help with that request.",
            reason: inputReport.action === "safe_complete" ? "safe completion" : "blocked by input guard",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const disclaimers = disclaimersFor(inputReport);
        if (disclaimers.length > 0) {
          for (const disclaimer of disclaimers) send({ type: "notice", text: disclaimer });
        }

        // The model receives the sanitised text, never the raw message.
        const modelMessages: ChatTurn[] = [
          ...ctx.history,
          { role: "user", content: inputReport.text },
        ];

        const guard = new StreamingOutputGuard(ctx);
        let aborted = false;

        for await (const chunk of provider.stream({
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          signal: request.signal,
        })) {
          const step = guard.push(chunk);
          if (step.abort) {
            aborted = true;
            recordAudit(step.abort, {
              sessionId,
              content: guard.draft,
              privacyPreserving: policy.privacyPreservingAudit,
            });
            send({ type: "output_report", report: step.abort });
            send({
              type: "replace",
              text: step.abort.responseOverride ?? "I withheld that response.",
              reason: "blocked by output guard",
            });
            break;
          }
          if (step.emit) send({ type: "delta", text: step.emit });
        }

        if (!aborted) {
          const { emit, report } = guard.finish();
          recordAudit(report, {
            sessionId,
            content: guard.draft,
            privacyPreserving: policy.privacyPreservingAudit,
          });

          if (report.action === "block" || report.action === "safe_complete") {
            send({ type: "output_report", report });
            send({
              type: "replace",
              text: report.responseOverride ?? "I withheld that response.",
              reason: "blocked by output guard",
            });
          } else if (report.action === "redact") {
            send({ type: "output_report", report });
            send({ type: "replace", text: report.text, reason: "redacted by output guard" });
          } else {
            if (emit) send({ type: "delta", text: emit });
            send({ type: "output_report", report });
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The model provider failed unexpectedly.";
        send({ type: "error", message });
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
