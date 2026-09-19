import type { GuardAction, Severity } from "@/lib/guardrails/types";

export const ACTION_LABEL: Record<GuardAction, string> = {
  allow: "Allowed",
  annotate: "Annotated",
  redact: "Redacted",
  safe_complete: "Safe completion",
  block: "Blocked",
};

export const ACTION_DESCRIPTION: Record<GuardAction, string> = {
  allow: "Passed every check without modification.",
  annotate: "Answered, with a disclaimer attached.",
  redact: "Rewritten before it moved on: sensitive spans replaced or quarantined.",
  safe_complete: "Answered with supportive written copy instead of generated text.",
  block: "Stopped. Written refusal copy was returned in place of a model response.",
};

/**
 * Colour carries meaning here, so each action gets a distinct hue rather than a
 * generic gradient: green passed, amber was modified, blue was handled with
 * care, red was stopped.
 */
export const ACTION_CLASS: Record<GuardAction, string> = {
  allow: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  annotate: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  redact: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  safe_complete: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  block: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  none: "text-muted-foreground",
  low: "text-sky-600 dark:text-sky-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

export const SEVERITY_BAR: Record<Severity, string> = {
  none: "bg-muted",
  low: "bg-sky-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export function formatMs(value: number): string {
  if (value < 1) return `${value.toFixed(2)}ms`;
  return `${value.toFixed(1)}ms`;
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}
