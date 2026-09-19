"use client";

import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_META, DEFAULT_POLICY, NON_NEGOTIABLE } from "@/lib/guardrails/policy";
import type { HarmCategory, PolicyOverrides } from "@/lib/guardrails/types";
import { ACTION_LABEL } from "@/lib/ui";

const GROUP_TITLES: Record<string, string> = {
  harm: "Physical harm",
  abuse: "Abuse & hate",
  privacy: "Privacy",
  integrity: "System integrity",
};

interface PolicyPanelProps {
  overrides: PolicyOverrides;
  onChange: (next: PolicyOverrides) => void;
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  locked,
  onCheckedChange,
  meta,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onCheckedChange: (value: boolean) => void;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
          {title}
          {locked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex" tabIndex={0} aria-label="Cannot be disabled">
                  <Lock className="size-3 text-muted-foreground" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-xs">
                Non-negotiable. The server ignores overrides for this category, so the toggle is
                genuinely inert rather than just hidden.
              </TooltipContent>
            </Tooltip>
          )}
        </Label>
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        {meta && <p className="font-mono text-[10px] text-muted-foreground/70">{meta}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function PolicyPanel({ overrides, onChange }: PolicyPanelProps) {
  const categoryEnabled = (id: HarmCategory) =>
    overrides.categories?.[id]?.enabled ?? DEFAULT_POLICY.categories[id].enabled;

  const setCategory = (id: HarmCategory, enabled: boolean) => {
    onChange({
      ...overrides,
      categories: { ...overrides.categories, [id]: { ...overrides.categories?.[id], enabled } },
    });
  };

  const grouped = Object.values(CATEGORY_META)
    .filter((meta) => meta.id !== "rate_limit" && meta.id !== "input_size")
    .reduce<Record<string, typeof CATEGORY_META[HarmCategory][]>>((accumulator, meta) => {
      accumulator[meta.group] = [...(accumulator[meta.group] ?? []), meta];
      return accumulator;
    }, {});

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline behaviour
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Turn a defence off and send the matching probe again to see exactly what it was doing.
        </p>
        <div className="mt-1 divide-y">
          <ToggleRow
            id="policy-redact-pii"
            title="Redact personal data"
            description="Substitute placeholders instead of blocking the turn. Off means messages containing personal data are refused outright."
            checked={overrides.redactPii ?? DEFAULT_POLICY.redactPii}
            onCheckedChange={(value) => onChange({ ...overrides, redactPii: value })}
          />
          <ToggleRow
            id="policy-streaming-guard"
            title="Streaming holdback"
            description="Withhold the tail of the stream until the output guard has scanned it. Off is faster and lets unsafe text reach the screen before it is retracted."
            checked={overrides.streamingGuard ?? DEFAULT_POLICY.streamingGuard}
            onCheckedChange={(value) => onChange({ ...overrides, streamingGuard: value })}
          />
          <ToggleRow
            id="policy-privacy-audit"
            title="Privacy-preserving audit"
            description="Log hashes and verdicts rather than message bodies. Off stores a 120-character preview in the activity log."
            checked={overrides.privacyPreservingAudit ?? DEFAULT_POLICY.privacyPreservingAudit}
            onCheckedChange={(value) => onChange({ ...overrides, privacyPreservingAudit: value })}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Each category shows its threshold and the action it takes when a message scores above it.
          </p>
        </div>

        {Object.entries(grouped).map(([group, entries]) => (
          <div key={group}>
            <h4 className="text-[11px] font-medium text-foreground/70">{GROUP_TITLES[group] ?? group}</h4>
            <div className="divide-y">
              {entries.map((meta) => {
                const locked = NON_NEGOTIABLE.includes(meta.id);
                const policy = DEFAULT_POLICY.categories[meta.id];
                return (
                  <ToggleRow
                    key={meta.id}
                    id={`policy-${meta.id}`}
                    title={meta.title}
                    description={meta.description}
                    meta={`threshold ${policy.threshold.toFixed(2)} · ${ACTION_LABEL[policy.maxAction].toLowerCase()}`}
                    checked={locked ? true : categoryEnabled(meta.id)}
                    disabled={locked}
                    locked={locked}
                    onCheckedChange={(value) => setCategory(meta.id, value)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
