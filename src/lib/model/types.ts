export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}

export interface ModelProvider {
  id: "openai" | "anthropic" | "local";
  label: string;
  /** Shown in the UI so it is always obvious which brain is answering. */
  description: string;
  model: string;
  stream(options: GenerateOptions): AsyncGenerator<string>;
}
