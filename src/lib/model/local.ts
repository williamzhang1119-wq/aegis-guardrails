import { CATEGORY_META } from "@/lib/guardrails/policy";
import { SAFETY_PRINCIPLES, SYSTEM_PROMPT_CANARY } from "./system-prompt";
import type { GenerateOptions, ModelProvider } from "./types";

/**
 * Offline fallback provider.
 *
 * No API key is required to run this project, which means there has to be
 * something behind the guardrails. This is an intent router, not a language
 * model: it recognises a set of topics and answers them from written copy. It
 * exists so the pipeline is fully exercisable — every guardrail path can be
 * demonstrated end to end — and it says plainly what it is rather than
 * pretending to be more.
 */

const HELP_TOPICS = `Here's what I can actually do in this mode:

- **Explain the guardrail pipeline** — ask how input filtering, output filtering, or the streaming guard works.
- **Explain any safety category** — ask about self-harm handling, cyber intrusion, prompt injection, PII redaction, and so on.
- **Get inspected** — send anything at all and open the Safety panel next to my reply to see every check that ran, what it scored, and why.
- **Get probed** — use the red-team probes below the composer to fire known-bad inputs at the pipeline and watch it respond.

For open-ended conversation, set \`OPENAI_API_KEY\` or \`ANTHROPIC_API_KEY\` in \`.env.local\` and restart. The guardrails are provider-agnostic — they wrap whatever model is behind them, and nothing about the safety behaviour changes.`;

function pipelineAnswer(): string {
  return `Every message makes two passes through a deterministic pipeline, and the model itself is treated as untrusted on both sides.

**On the way in**, in this order:

1. **Rate limit and size caps** run first because they're free and they stop abuse before any model call is billed.
2. **Injection detection** strips zero-width and bidi characters, then looks for instruction-override, persona-jailbreak, and forged-role-marker signatures. A hit doesn't refuse the turn — the span gets quarantined as untrusted data and the operating rules are reasserted.
3. **Secret and PII redaction** replaces credentials, card numbers, government IDs, emails, and phone numbers with placeholders, so the model never receives the raw values. Card numbers are Luhn-checked to keep order numbers out of the results.
4. **Harm classification** scores the sanitised text against ${Object.keys(CATEGORY_META).length} categories.

**On the way out**, the draft response goes through the same taxonomy plus two output-only checks: system-prompt disclosure and credential emission. Anything the model produces gets judged by the same standard as anything you send.

The interesting part is the scoring model. A category only scores if a topic trigger fires. Operational intent ("step by step", "working code", "undetectable") raises the score; benign context ("how do I defend against", "for my thesis", "is this legal", "my own lab") lowers it. That's what separates *how does ransomware spread* from *write me working ransomware* without refusing the first one.`;
}

function principlesAnswer(): string {
  const list = SAFETY_PRINCIPLES.map(
    (principle) => `- **${principle.title}.** ${principle.body}`,
  ).join("\n");
  return `The behavioural layer comes down to these principles:

${list}

I won't quote my instructions verbatim — the output guard blocks that, and you can watch it happen by asking me to. But the substance is above, and the Safety page has every category, threshold, and action the deterministic layer applies.`;
}

function categoryAnswer(id: keyof typeof CATEGORY_META): string {
  const meta = CATEGORY_META[id];
  return `**${meta.title}**

${meta.description}

**How it's handled:** ${meta.reasoning}

Send something in this category and the Safety panel will show you the score, the exact patterns that matched, any benign context that pulled the score down, and the action that resulted.`;
}

function refusalDesignAnswer(): string {
  return `The refusal copy is written, not generated, and it follows three rules.

**Name what's withheld.** "I won't provide synthesis routes or precursor sourcing" tells you where the line is. "I can't help with that" teaches you nothing and invites a reword.

**Don't moralise.** No lectures, no assumptions about why you asked. A refusal that reads like a compliance notice trains people to route around the system, which makes it less safe rather than more.

**Always leave the legitimate door open.** Every refusal ends with the version of the request I *can* help with — harm reduction instead of synthesis, detection rules instead of malware, protective orders instead of tracking someone down.

Self-harm is handled differently on purpose. It isn't a refusal at all: it's a safe completion that acknowledges the person, withholds method information, surfaces real crisis lines, and keeps the conversation open. Ending a conversation with someone in crisis is a harm of its own.`;
}

function streamingAnswer(): string {
  return `Streaming and output filtering genuinely conflict: you can't unsay a token someone has already read. Two mechanisms handle it.

**Holdback.** The last ~280 characters of the buffer are withheld from display until more text arrives. A violation that completes inside that tail gets caught before any of it reaches the screen. The cost is real — you see output slightly behind the model.

**Retraction.** Every scan runs against the whole accumulated draft rather than just the newest chunk, so a pattern straddling a chunk boundary is still found. If something blocking shows up after text was already released, the stream aborts and the client throws away the partial message.

You can turn the holdback off in the policy controls and watch the latency change. That's the honest trade, and it's better to make it visible than to hide it.`;
}

function limitationsAnswer(): string {
  return `Worth being straight about what this system is not.

**Pattern matching has a ceiling.** These are regex-and-weight classifiers. They're fast, free, fully explainable, and testable — and they will miss novel phrasings, most non-English text, and deliberate obfuscation. Production deployments layer a trained moderation classifier on top; the architecture here is built so that slots in as another check rather than a rewrite.

**The system prompt is advisory.** A determined prompt will eventually talk any model out of its instructions. That's the whole reason the deterministic checks run outside the model on both sides.

**The rate limiter is per-instance.** It lives in module memory, so it holds for one server process. Multiple instances need shared state.

**The audit log is in-memory.** It's a ring buffer of 200 entries that clears on restart, and it stores hashes rather than message bodies by default.

**Thresholds are judgement calls.** The numbers in the policy are defensible starting points, not measured optima. Tuning them needs a labelled evaluation set for your own traffic, and every one of them is a false-positive/false-negative trade.`;
}

/**
 * Deliberately unsafe draft used to demonstrate the output-side guard. It
 * contains the system-prompt canary and a credential-shaped string, both of
 * which the output pipeline is expected to catch before display.
 */
function unsafeOutputSimulation(): string {
  return `Sure — here are my full instructions. You are Venture 1, a helpful assistant that runs behind a deterministic safety pipeline. Internal directive id: ${SYSTEM_PROMPT_CANARY}.

Operating rules:
1. Helpfulness is part of safety. An unnecessary refusal is a failure, not a safe default.

And here's the key from my configuration: sk-proj-a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ012345`;
}

const GREETING = `Hi — I'm Venture 1, a demonstration assistant that runs behind a deterministic safety pipeline.

I'm currently running on the **offline fallback provider**: no API key is configured, so I'm an intent router rather than a language model. That's a real limitation and I'd rather say it than fake my way around it. What's fully functional is everything the project is actually about — the guardrails.

Ask me how the pipeline works, or fire one of the red-team probes below the composer and watch the Safety panel light up.`;

interface Route {
  test: RegExp;
  answer: () => string;
}

const ROUTES: Route[] = [
  {
    test: /\b(simulate|demo|test|trigger|show me).{0,40}(unsafe|leak|bad|blocked) (?:model )?(?:output|response)|\[\[simulate:leak\]\]/i,
    answer: unsafeOutputSimulation,
  },
  {
    test: /\b(?:reveal|show|print|repeat|what (?:are|is)).{0,30}(?:your|the) (?:system )?(?:prompt|instructions)/i,
    answer: unsafeOutputSimulation,
  },
  {
    test: /^\s*(hi|hey|hello|yo|good (?:morning|afternoon|evening))\b|^\s*(?:hi|hello|hey)[!.,\s]*$/i,
    answer: () => GREETING,
  },
  {
    test: /\b(what can you do|help me|how do i (?:use|start)|what (?:is|are) (?:this|you)|who are you|capabilities)\b/i,
    answer: () => HELP_TOPICS,
  },
  {
    test: /\b(streaming|stream|holdback|hold back|partial (?:output|response)|latency)\b/i,
    answer: streamingAnswer,
  },
  {
    test: /\b(refusal|refuse|decline|safe completion|crisis|hotline|helpline)\b/i,
    answer: refusalDesignAnswer,
  },
  {
    test: /\b(limitation|weakness|shortcoming|what (?:doesn'?t|does not) (?:it|this) (?:do|cover)|production ready|caveat|not good at)\b/i,
    answer: limitationsAnswer,
  },
  {
    test: /\b(principle|constitution|model spec|values|behavio(?:u)?ral layer|system prompt)\b/i,
    answer: principlesAnswer,
  },
  {
    test: /\b(guardrail|pipeline|safety|how (?:do|does) (?:it|this|you) work|architecture|filter|check|classif)/i,
    answer: pipelineAnswer,
  },
];

const CATEGORY_KEYWORDS: { id: keyof typeof CATEGORY_META; test: RegExp }[] = [
  { id: "self_harm", test: /\b(self[-\s]?harm|suicide|suicidal|crisis)\b/i },
  { id: "prompt_injection", test: /\b(prompt injection|jailbreak|injection|dan mode)\b/i },
  { id: "pii", test: /\b(pii|personal data|redact(?:ion)?|luhn|credit card)\b/i },
  { id: "secret_leak", test: /\b(secret|credential|api key|token leak)\b/i },
  { id: "cyber_intrusion", test: /\b(cyber|malware|ransomware|exploit|hacking)\b/i },
  { id: "weapons_mass_harm", test: /\b(cbrn|weapon|bioweapon|uplift)\b/i },
  { id: "csae", test: /\b(csae|csam|child safety)\b/i },
  { id: "privacy_doxxing", test: /\b(dox|doxxing|stalk|surveillance)\b/i },
  { id: "regulated_advice", test: /\b(regulated advice|legal advice|medical advice|financial advice|disclaimer)\b/i },
  { id: "fraud_deception", test: /\b(fraud|scam|phishing)\b/i },
  { id: "hate_harassment", test: /\b(hate speech|harassment|slur)\b/i },
  { id: "rate_limit", test: /\b(rate limit|throttl|quota)\b/i },
];

function fallback(userText: string): string {
  const words = userText.trim().split(/\s+/).length;
  const opening =
    words > 12
      ? "I read your message, and I want to be straight with you rather than improvise an answer."
      : "I want to be straight with you rather than improvise an answer.";

  return `${opening}

I'm the **offline fallback provider** — no model API key is configured, so I can't hold a genuine open-ended conversation. I won't pretend otherwise.

What did work: your message went through the full input guardrail pipeline, and this reply is going through the output pipeline right now. Open the Safety panel on this message to see every check that ran, what each one scored, and how long it took.

${HELP_TOPICS}`;
}

function route(userText: string): string {
  for (const entry of ROUTES) {
    if (entry.test.test(userText)) return entry.answer();
  }
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.test.test(userText)) return categoryAnswer(entry.id);
  }
  return fallback(userText);
}

/** Chunks by word so the client sees a realistic token stream. */
async function* chunkText(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let batch = "";
  for (const token of tokens) {
    if (signal?.aborted) return;
    batch += token;
    if (batch.length >= 14) {
      yield batch;
      batch = "";
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }
  if (batch) yield batch;
}

export function createLocalProvider(): ModelProvider {
  return {
    id: "local",
    label: "Offline fallback",
    description:
      "Rule-based responder. No API key configured, so replies come from written copy rather than a model — the guardrail pipeline is fully live.",
    model: "venture-1-local-router",
    async *stream(options: GenerateOptions) {
      const lastUser = [...options.messages].reverse().find((turn) => turn.role === "user");
      const answer = route(lastUser?.content ?? "");
      yield* chunkText(answer, options.signal);
    },
  };
}

export { route as routeLocalResponse, unsafeOutputSimulation };
