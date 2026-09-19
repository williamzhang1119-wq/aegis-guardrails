"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ProbeDeck } from "@/components/chat/probe-deck";
import { ActivityPanel } from "@/components/safety/activity-panel";
import { PolicyPanel } from "@/components/safety/policy-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGuardedChat } from "@/hooks/use-guarded-chat";
import type { PolicyOverrides } from "@/lib/guardrails/types";
import { cn } from "@/lib/utils";

function ProviderBadge({
  provider,
}: {
  provider: ReturnType<typeof useGuardedChat>["provider"];
}) {
  if (!provider) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-[10px]",
        provider.isFallback
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {provider.isFallback ? "Offline fallback model" : `${provider.label} · ${provider.model}`}
    </Badge>
  );
}

function ControlPanel({
  overrides,
  onChange,
  sessionId,
  refreshKey,
}: {
  overrides: PolicyOverrides;
  onChange: (next: PolicyOverrides) => void;
  sessionId: string;
  refreshKey: number;
}) {
  return (
    <Tabs defaultValue="policy" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="w-full">
        <TabsTrigger value="policy" className="flex-1 text-xs">
          Policy
        </TabsTrigger>
        <TabsTrigger value="activity" className="flex-1 text-xs">
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="policy" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <PolicyPanel overrides={overrides} onChange={onChange} />
      </TabsContent>
      <TabsContent value="activity" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <ActivityPanel sessionId={sessionId} refreshKey={refreshKey} />
      </TabsContent>
    </Tabs>
  );
}

export function ChatWorkbench() {
  const [overrides, setOverrides] = useState<PolicyOverrides>({});
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const policy = useMemo(() => overrides, [overrides]);
  const { messages, send, stop, reset, isStreaming, provider, error, sessionId } =
    useGuardedChat(policy);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Only follow the stream while the reader is already at the bottom. */
  const pinnedRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !pinnedRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
  };

  const submit = () => {
    const text = draft;
    setDraft("");
    void send(text);
  };

  const fireProbe = (prompt: string) => {
    setDraft("");
    void send(prompt);
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 gap-6 px-4 pb-4 sm:px-6 lg:px-8">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ProviderBadge provider={provider} />
            {messages.length > 0 && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {messages.filter((message) => message.role === "user").length} turn
                {messages.filter((message) => message.role === "user").length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 gap-1.5 text-xs">
                <RotateCcw className="size-3" aria-hidden />
                Clear
              </Button>
            )}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs lg:hidden">
                  <SlidersHorizontal className="size-3" aria-hidden />
                  Controls
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
                <SheetHeader className="gap-1">
                  <SheetTitle className="text-base">Guardrail controls</SheetTitle>
                  <SheetDescription className="text-xs">
                    Live policy for this session, plus the audit trail of every decision.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                  <ControlPanel
                    overrides={overrides}
                    onChange={setOverrides}
                    sessionId={sessionId}
                    refreshKey={messages.length}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-5 pb-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <ProbeDeck onSelect={fireProbe} disabled={isStreaming} />
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={stop}
            isStreaming={isStreaming}
          />
        </div>
      </div>

      <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col border-l pl-6 pt-3 lg:flex xl:w-[380px]">
        <ControlPanel
          overrides={overrides}
          onChange={setOverrides}
          sessionId={sessionId}
          refreshKey={messages.length}
        />
      </aside>
    </div>
  );
}
