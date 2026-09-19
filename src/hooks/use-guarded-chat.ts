"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { GuardrailReport, PolicyOverrides } from "@/lib/guardrails/types";
import type { ProviderInfo } from "@/lib/model/provider";
import { decodeEvents, SESSION_HEADER, type ChatEvent } from "@/lib/protocol";

export type MessageStatus = "streaming" | "complete" | "blocked" | "redacted" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  /** What the user sees. For assistant turns this can be replaced mid-stream. */
  content: string;
  status: MessageStatus;
  /** Verdict on the user's message, attached to the user turn. */
  inputReport?: GuardrailReport;
  /** Verdict on the model's draft, attached to the assistant turn. */
  outputReport?: GuardrailReport;
  /** Disclaimers surfaced by `annotate` outcomes. */
  notices: string[];
  /** Why the content was swapped out, when it was. */
  replacedReason?: string;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSessionId(): string {
  if (typeof window === "undefined") return newId("srv");
  const existing = window.sessionStorage.getItem("venture-1-session");
  if (existing) return existing;
  const created = newId("sess");
  window.sessionStorage.setItem("venture-1-session", created);
  return created;
}

export function useGuardedChat(policy: PolicyOverrides) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionId = useMemo(() => createSessionId(), []);

  const patch = useCallback((id: string, update: Partial<UiMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  }, []);

  const append = useCallback((id: string, text: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, content: message.content + text } : message,
      ),
    );
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      const userMessage: UiMessage = {
        id: newId("user"),
        role: "user",
        content: trimmed,
        status: "complete",
        notices: [],
      };
      const assistantId = newId("asst");
      const assistantMessage: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
        notices: [],
      };

      const history = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", [SESSION_HEADER]: sessionId },
          body: JSON.stringify({ messages: history, policy }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? `Request failed with status ${response.status}.`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handle = (event: ChatEvent) => {
          switch (event.type) {
            case "provider":
              setProvider(event.provider);
              break;
            case "input_report":
              patch(userMessage.id, { inputReport: event.report });
              break;
            case "delta":
              append(assistantId, event.text);
              break;
            case "replace":
              patch(assistantId, {
                content: event.text,
                replacedReason: event.reason,
                status: event.reason.includes("redact") ? "redacted" : "blocked",
              });
              break;
            case "output_report":
              patch(assistantId, { outputReport: event.report });
              break;
            case "notice":
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, notices: [...message.notices, event.text] }
                    : message,
                ),
              );
              break;
            case "error":
              setError(event.message);
              patch(assistantId, { status: "error" });
              break;
            case "done":
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId && message.status === "streaming"
                    ? { ...message, status: "complete" }
                    : message,
                ),
              );
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = decodeEvents(buffer);
          buffer = rest;
          for (const event of events) handle(event);
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          patch(assistantId, { status: "complete" });
        } else {
          const message = caught instanceof Error ? caught.message : "Something went wrong.";
          setError(message);
          patch(assistantId, { status: "error" });
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [append, isStreaming, messages, patch, policy, sessionId],
  );

  return { messages, send, stop, reset, isStreaming, provider, error, sessionId };
}
