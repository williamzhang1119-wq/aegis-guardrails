"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VerdictBadge } from "@/components/safety/verdict-badge";
import { cn } from "@/lib/utils";
import type { CheckResult, GuardrailReport } from "@/lib/guardrails/types";
import { ACTION_DESCRIPTION, ACTION_LABEL, formatMs, SEVERITY_BAR, SEVERITY_CLASS } from "@/lib/ui";

function ScoreBar({ check }: { check: CheckResult }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-all", SEVERITY_BAR[check.severity])}
          style={{ width: `${Math.max(4, check.score * 100)}%` }}
        />
      </div>
      <span className={cn("font-mono text-[11px] tabular-nums", SEVERITY_CLASS[check.severity])}>
        {check.score.toFixed(2)}
      </span>
    </div>
  );
}

function CheckCard({ check }: { check: CheckResult }) {
  return (
    <li className="rounded-lg border bg-card/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{check.title}</span>
          <VerdictBadge action={check.action} className="text-[10px]" />
        </div>
        <ScoreBar check={check} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{check.rationale}</p>

      {check.evidence.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {check.evidence.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-start gap-2 text-[11px]">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
              <span className="text-muted-foreground">
                <span className="text-foreground/80">{item.label}</span>
                {item.excerpt ? <> — “{item.excerpt}”</> : null}
                <span className="ml-1 font-mono opacity-60">+{item.weight.toFixed(2)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {check.mitigated && check.mitigated.length > 0 && (
        <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
          Score reduced by benign context: {check.mitigated.join(", ").toLowerCase()}.
        </p>
      )}

      <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
        {check.checkId} · {formatMs(check.durationMs)}
      </p>
    </li>
  );
}

export function ReportInspector({
  report,
  label,
  defaultOpen = false,
}: {
  report: GuardrailReport;
  label: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const checkCount = report.checks.length;

  return (
    <div className="rounded-xl border bg-muted/30">
      <Button
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-auto w-full justify-between gap-2 px-3 py-2 hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          <VerdictBadge action={report.action} className="shrink-0 text-[10px]" />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:inline">
            {checkCount === 0 ? "no findings" : `${checkCount} finding${checkCount === 1 ? "" : "s"}`} ·{" "}
            {formatMs(report.totalDurationMs)}
          </span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </Button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          <Separator />
          <p className="text-xs text-muted-foreground">{ACTION_DESCRIPTION[report.action]}</p>

          {checkCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              Every check ran and none of them found anything. The full pipeline took{" "}
              {formatMs(report.totalDurationMs)}.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...report.checks]
                .sort((a, b) => b.score - a.score)
                .map((check) => (
                  <CheckCard key={check.checkId} check={check} />
                ))}
            </ul>
          )}

          {report.redactions.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Replaced before the model saw it
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.redactions.map((redaction) => (
                  <li key={redaction.placeholder} className="font-mono text-[11px] text-muted-foreground">
                    {redaction.placeholder} <span className="opacity-60">({redaction.hint})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.phase === "input" && report.action !== "allow" && (
            <details className="group rounded-lg border bg-card/50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Text the model actually received
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
                {report.text}
              </pre>
            </details>
          )}

          <p className="text-[10px] text-muted-foreground/70">
            {ACTION_LABEL[report.action]} · severity {report.severity} · phase {report.phase}
          </p>
        </div>
      )}
    </div>
  );
}
