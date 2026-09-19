"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VerdictBadge } from "@/components/safety/verdict-badge";
import type { AuditEntry } from "@/lib/guardrails/audit";
import { SESSION_HEADER } from "@/lib/protocol";
import { formatMs, titleCase } from "@/lib/ui";

interface AuditPayload {
  entries: AuditEntry[];
  summary: {
    total: number;
    byAction: Record<string, number>;
    byCategory: Record<string, number>;
    p95DurationMs: number;
  };
}

export function ActivityPanel({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const [data, setData] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/audit", { headers: { [SESSION_HEADER]: sessionId } });
        const payload = (await response.json()) as AuditPayload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [nonce, refreshKey, sessionId]);

  const refresh = () => {
    setLoading(true);
    setNonce((value) => value + 1);
  };

  const entries = data?.entries ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Audit log
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Every decision the pipeline made this session. Message bodies are hashed, not stored, unless
            you turn privacy mode off.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={refresh}
          aria-label="Refresh audit log"
          className="size-7 shrink-0"
        >
          <RefreshCw className="size-3.5" aria-hidden />
        </Button>
      </div>

      {summary && summary.total > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-card/50 p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Decisions</dt>
              <dd className="font-mono text-lg tabular-nums">{summary.total}</dd>
            </div>
            <div className="rounded-lg border bg-card/50 p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">p95 latency</dt>
              <dd className="font-mono text-lg tabular-nums">{formatMs(summary.p95DurationMs)}</dd>
            </div>
          </dl>

          {Object.keys(summary.byCategory).length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium text-foreground/70">Categories seen</h4>
              <ul className="mt-1.5 space-y-1">
                {Object.entries(summary.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <li key={category} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{titleCase(category)}</span>
                      <span className="font-mono tabular-nums">{count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <Separator />
        </>
      )}

      {loading && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nothing logged yet. Send a message and every check that runs will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border bg-card/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <VerdictBadge action={entry.action} className="text-[10px]" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {titleCase(entry.phase)} phase · {entry.contentLength} chars ·{" "}
                {formatMs(entry.durationMs)}
                {entry.redactionCount > 0 ? ` · ${entry.redactionCount} redaction(s)` : ""}
              </p>
              {entry.categories.length > 0 && (
                <p className="mt-1 text-[11px]">
                  {[...new Set(entry.categories)].map(titleCase).join(", ")}
                </p>
              )}
              <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                sha256:{entry.contentHash}
              </p>
              {entry.preview && (
                <p className="mt-1 rounded border border-dashed px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                  {entry.preview}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
