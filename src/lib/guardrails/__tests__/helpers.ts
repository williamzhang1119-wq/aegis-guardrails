import { resolvePolicy } from "../policy";
import type { GuardrailContext, PolicyOverrides } from "../types";

export function makeContext(overrides?: PolicyOverrides, sessionId = "test-session"): GuardrailContext {
  return {
    sessionId,
    policy: resolvePolicy(overrides),
    history: [],
    now: Date.now(),
  };
}
