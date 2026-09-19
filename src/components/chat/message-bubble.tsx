"use client";

import { AlertTriangle, Info, ShieldAlert, ShieldX, User } from "lucide-react";
import { MarkdownBody } from "@/components/chat/markdown";
import { ReportInspector } from "@/components/safety/report-inspector";
import { cn } from "@/lib/utils";
import type { UiMessage } from "@/hooks/use-guarded-chat";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Generating response">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function InterventionBanner({ message }: { message: UiMessage }) {
  if (message.status !== "blocked" && message.status !== "redacted") return null;

  const blocked = message.status === "blocked";
  const Icon = blocked ? ShieldX : ShieldAlert;

  return (
    <div
      className={cn(
        "mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        blocked
          ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium">
          {blocked ? "The guardrails intervened." : "The output guard rewrote this response."}
        </span>{" "}
        {message.replacedReason
          ? `This message was ${message.replacedReason}, so what you see below is policy copy rather than a model response.`
          : "What you see below is policy copy rather than a model response."}
      </span>
    </div>
  );
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card text-[10px] font-semibold tracking-tight"
        >
          V1
        </div>
      )}

      <div className={cn("min-w-0 space-y-2", isUser ? "max-w-[85%]" : "w-full max-w-[92%]")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser ? "bg-primary text-primary-foreground" : "border bg-card",
          )}
        >
          {!isUser && <InterventionBanner message={message} />}

          {message.notices.map((notice) => (
            <div
              key={notice}
              className="mb-3 flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-800 dark:text-sky-200"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <MarkdownBody className="text-xs [&_p]:mt-0">{notice}</MarkdownBody>
            </div>
          ))}

          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          ) : message.content ? (
            <MarkdownBody>{message.content}</MarkdownBody>
          ) : message.status === "streaming" ? (
            <TypingDots />
          ) : (
            <p className="text-sm text-muted-foreground">No content was returned.</p>
          )}

          {message.status === "error" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>The provider call failed. The guardrail reports above still reflect what ran.</span>
            </div>
          )}
        </div>

        {message.inputReport && (
          <ReportInspector report={message.inputReport} label="Input guardrails" />
        )}
        {message.outputReport && (
          <ReportInspector
            report={message.outputReport}
            label="Output guardrails"
            defaultOpen={message.outputReport.action !== "allow"}
          />
        )}
      </div>

      {isUser && (
        <div
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card"
        >
          <User className="size-3.5 text-muted-foreground" />
        </div>
      )}
    </article>
  );
}
