import type { GenerateOptions, ModelProvider } from "./types";

/**
 * Minimal SSE reader shared by both remote providers. Written by hand rather
 * than pulled from an SDK so the request surface stays small and auditable.
 */
async function* readSse(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload && payload !== "[DONE]") yield payload;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function assertOk(response: Response, provider: string): void {
  if (response.ok) return;
  throw new Error(
    `${provider} request failed with ${response.status}. Check the API key and model name in .env.local.`,
  );
}

export function createOpenAiProvider(apiKey: string, model: string): ModelProvider {
  return {
    id: "openai",
    label: "OpenAI",
    description: `Live model responses via ${model}, wrapped by the same guardrail pipeline.`,
    model,
    async *stream({ system, messages, signal }: GenerateOptions) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          temperature: 0.7,
          messages: [{ role: "system", content: system }, ...messages],
        }),
        signal,
      });
      assertOk(response, "OpenAI");

      for await (const payload of readSse(response, signal)) {
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) yield delta;
        } catch {
          // A malformed keep-alive frame is not worth failing the stream over.
        }
      }
    },
  };
}

export function createAnthropicProvider(apiKey: string, model: string): ModelProvider {
  return {
    id: "anthropic",
    label: "Anthropic",
    description: `Live model responses via ${model}, wrapped by the same guardrail pipeline.`,
    model,
    async *stream({ system, messages, signal }: GenerateOptions) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system,
          max_tokens: 1500,
          stream: true,
          messages,
        }),
        signal,
      });
      assertOk(response, "Anthropic");

      for await (const payload of readSse(response, signal)) {
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.type === "content_block_delta" && typeof parsed?.delta?.text === "string") {
            yield parsed.delta.text;
          }
        } catch {
          // Ignore frames that are not JSON deltas.
        }
      }
    },
  };
}
