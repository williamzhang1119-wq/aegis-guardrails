"use client";

import { useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_POLICY } from "@/lib/guardrails/policy";

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const limit = DEFAULT_POLICY.limits.maxCharsPerMessage;
  const overLimit = value.length > limit;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!overLimit) onSubmit();
      }}
      // Clicking the padding around a small input is a common miss. Treat the
      // whole card as the target and hand focus to the textarea.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          ref.current?.focus();
        }
      }}
      className="cursor-text rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring"
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!overLimit) onSubmit();
          }
        }}
        rows={1}
        placeholder="Ask anything, or fire a probe at the pipeline…"
        aria-label="Message"
        // `field-sizing-content` on the base component grows the field with its
        // content, so no resize effect is needed — just a floor and a ceiling.
        className="max-h-52 min-h-11 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-0.5 pt-1">
        <p className="text-[11px] text-muted-foreground">
          {overLimit ? (
            <span className="text-destructive">
              {value.length.toLocaleString()} / {limit.toLocaleString()} characters — over the limit
            </span>
          ) : (
            <>
              <kbd className="rounded border px-1 font-sans text-[10px]">Enter</kbd> to send ·{" "}
              <kbd className="rounded border px-1 font-sans text-[10px]">Shift</kbd>+
              <kbd className="rounded border px-1 font-sans text-[10px]">Enter</kbd> for a new line
            </>
          )}
        </p>

        {isStreaming ? (
          <Button type="button" size="sm" variant="outline" onClick={onStop} className="gap-1.5">
            <Square className="size-3" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={value.trim().length === 0 || overLimit}
            aria-label="Send message"
            className="size-8 rounded-full"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}
