import { createLocalProvider } from "./local";
import { createAnthropicProvider, createOpenAiProvider } from "./remote";
import type { ModelProvider } from "./types";

/**
 * Picks a provider from the environment.
 *
 * The project runs with no configuration at all, which is the point: the
 * guardrails are the product, and they should be inspectable without anyone
 * having to supply a credential first. Add a key and the same pipeline wraps a
 * real model instead.
 */
export function selectProvider(): ModelProvider {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return createOpenAiProvider(openAiKey, process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return createAnthropicProvider(
      anthropicKey,
      process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest",
    );
  }

  return createLocalProvider();
}

export interface ProviderInfo {
  id: ModelProvider["id"];
  label: string;
  description: string;
  model: string;
  isFallback: boolean;
}

export function describeProvider(provider: ModelProvider): ProviderInfo {
  return {
    id: provider.id,
    label: provider.label,
    description: provider.description,
    model: provider.model,
    isFallback: provider.id === "local",
  };
}
