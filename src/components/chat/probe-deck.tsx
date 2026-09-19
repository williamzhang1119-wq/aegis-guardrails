"use client";

import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROBE_GROUPS, PROBES } from "@/lib/probes";
import { cn } from "@/lib/utils";

const GROUP_ACCENT: Record<string, string> = {
  baseline: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
  "dual-use": "border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/5",
  refused: "border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5",
  integrity: "border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5",
  privacy: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
  output: "border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5",
};

export function ProbeDeck({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string>("refused");
  const probes = PROBES.filter((probe) => probe.group === group);
  const activeGroup = PROBE_GROUPS.find((entry) => entry.id === group);

  return (
    <div className="rounded-xl border bg-card/60">
      <Button
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-auto w-full justify-between px-3 py-2.5"
      >
        <span className="flex items-center gap-2">
          <FlaskConical className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium">Red-team probes</span>
          <Badge variant="secondary" className="text-[10px]">
            {PROBES.length}
          </Badge>
        </span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            {PROBE_GROUPS.map((entry) => (
              <Button
                key={entry.id}
                size="sm"
                variant={group === entry.id ? "default" : "outline"}
                onClick={() => setGroup(entry.id)}
                className="h-7 rounded-full px-3 text-[11px]"
              >
                {entry.title}
              </Button>
            ))}
          </div>

          {activeGroup && <p className="text-xs text-muted-foreground">{activeGroup.blurb}</p>}

          <ul className="grid gap-2 sm:grid-cols-2">
            {probes.map((probe) => (
              <li key={probe.label}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(probe.prompt)}
                  className={cn(
                    "w-full rounded-lg border bg-background p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    GROUP_ACCENT[probe.group],
                  )}
                >
                  <span className="block text-xs font-medium">{probe.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {probe.expected}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
