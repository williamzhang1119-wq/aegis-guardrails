import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GuardAction } from "@/lib/guardrails/types";
import { ACTION_CLASS, ACTION_LABEL } from "@/lib/ui";

export function VerdictBadge({
  action,
  className,
  children,
}: {
  action: GuardAction;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", ACTION_CLASS[action], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children ?? ACTION_LABEL[action]}
    </Badge>
  );
}
