import type { GuardrailReport, HarmCategory } from "./types";

/**
 * Response copy for blocked and safe-completed turns.
 *
 * The rule followed here: name what is being withheld, do not moralise, and
 * always leave a door open to the legitimate version of the request. A refusal
 * that reads like a compliance notice teaches users to route around the system.
 */
const REFUSALS: Partial<Record<HarmCategory, string>> = {
  csae: "I won't engage with anything that sexualises a minor, in any framing.\n\nIf you're dealing with a real situation — a concern about a child, or material you've encountered — report it to your local police or, in the US, to the NCMEC CyberTipline at report.cybertip.org. I can help you understand safeguarding processes or how to make a report.",
  weapons_mass_harm:
    "I can't help with making or deploying weapons capable of mass casualties. That's a hard line regardless of the reason behind the question.\n\nI'm glad to go into the history of these programs, how arms-control treaties and verification work, how detection and decontamination are done, or the medical response to exposure.",
  violence_threat:
    "I won't help plan violence against someone or help conceal it.\n\nIf you're in a conflict that feels like it's escalating, I can help you think through de-escalation, documentation, protective orders, or how to involve someone who can intervene. If you're the one in danger, tell me and we'll start there.",
  cyber_intrusion:
    "I can't write working intrusion tooling or help access a system you don't have permission to touch.\n\nWhat I can do is explain how a technique works and how it's detected, review your own code for the weakness, help you build detection rules, or work through an authorised engagement or CTF box with you. If this is your own system, say so and describe it — that changes what I can help with.",
  illicit_drugs:
    "I won't provide synthesis routes, precursor sourcing, or distribution logistics for controlled substances.\n\nIf the underlying question is about safety, I can cover harm reduction, drug testing, overdose response and naloxone, interactions, or how to find treatment. Pharmacology and drug policy are fine ground too.",
  hate_harassment:
    "I won't produce content that dehumanises people or that's meant to harass someone.\n\nIf you're studying this material, moderating it, or building a classifier for it, I can help with that directly — including analysing why a specific piece of content works the way it does.",
  extremism:
    "I won't write propaganda or recruitment material for violent extremist movements.\n\nI can help with research, threat assessment, counter-messaging, or understanding how radicalisation pathways work and what interrupts them.",
  fraud_deception:
    "I can't build phishing assets, forged documents, or scam scripts.\n\nIf you're on the defending side, I can help with fraud detection logic, security-awareness material, recognising the patterns in something you've received, or reporting it to the right place.",
  privacy_doxxing:
    "I won't help locate, identify, or covertly monitor a specific person.\n\nIf you're trying to protect your own privacy, I can help you lock down accounts, get data removed from brokers, or document harassment. If there's a safety concern involving someone else, the route is a police report or a protective order, and I can help you prepare either.",
  secret_leak:
    "I stopped that response because it contained something shaped like a live credential. Emitting a key is the failure mode — redacting it after the fact isn't enough.\n\nIf a real key was involved, rotate it. I'm happy to talk through secret management, scanning your history, or setting up pre-commit hooks.",
  system_prompt_leak:
    "I'm not going to reproduce my own instructions.\n\nI can tell you plainly how I work, though: there's a deterministic guardrail pipeline on both sides of the model, and the Safety page in this app documents every category, threshold, and action it applies.",
  prompt_injection:
    "That message looked like an attempt to replace my instructions, so I've treated it as text to discuss rather than orders to follow.\n\nIf you were testing the injection defences, the Safety page lists every signature the detector uses. If you had a real question in there, ask it directly and I'll answer it.",
  rate_limit:
    "You've hit this session's message budget. Give it a moment and try again — the limiter is there to keep automated abuse and runaway cost in check.",
  input_size:
    "That message is over the size limit for a single turn. Trim it to the part you actually want me to work on, or split it across a couple of messages.",
};

const GENERIC_REFUSAL =
  "I can't help with that particular request.\n\nTell me more about what you're actually trying to accomplish and I'll find the part I can help with.";

/**
 * Safe completion for self-harm. This is not a refusal — it is the response the
 * system considers correct, and it must never contain method information.
 */
const SELF_HARM_SAFE_COMPLETION = [
  "I'm really glad you said something, and I don't want to hand you a script and walk away. It sounds like you're carrying something very heavy right now.",
  "",
  "I'm not able to give you information about methods, and I won't. What I can do is stay in this conversation with you.",
  "",
  "If you're in immediate danger, please reach out to someone who can be with you right now:",
  "",
  "- **US & Canada:** call or text **988** (Suicide & Crisis Lifeline)",
  "- **UK & Ireland:** call **116 123** (Samaritans)",
  "- **Australia:** call **13 11 14** (Lifeline)",
  "- **Everywhere else:** findahelpline.com lists free, confidential lines by country",
  "- If you feel you might act soon, please call your local emergency number or get to an emergency department.",
  "",
  "If you'd rather keep talking here, I'm listening. What's been going on?",
].join("\n");

const DISCLAIMERS: Partial<Record<HarmCategory, string>> = {
  dangerous_medical:
    "**A note before the answer:** this is general information, not medical advice, and I can't account for your history, other medications, or dosing. Anything involving dose changes or stopping a prescription needs a pharmacist or prescriber — a pharmacist will usually answer for free.",
  regulated_advice:
    "**A note before the answer:** this is general information, not professional advice. Specifics here turn on your jurisdiction and your circumstances, so treat it as background for a conversation with a licensed professional rather than a substitute for one.",
  adult_sexual:
    "**A note before the answer:** I keep this kind of material non-graphic. I can write the scene with the intensity implied rather than described.",
};

/** Ordered by how much the response must be shaped by the category. */
const PRIORITY: HarmCategory[] = [
  "csae",
  "self_harm",
  "weapons_mass_harm",
  "violence_threat",
  "extremism",
  "cyber_intrusion",
  "illicit_drugs",
  "fraud_deception",
  "privacy_doxxing",
  "hate_harassment",
  "secret_leak",
  "system_prompt_leak",
  "prompt_injection",
  "rate_limit",
  "input_size",
];

export function primaryCategory(categories: HarmCategory[]): HarmCategory | undefined {
  for (const candidate of PRIORITY) {
    if (categories.includes(candidate)) return candidate;
  }
  return categories[0];
}

export function buildResponseOverride(report: GuardrailReport): string | undefined {
  if (report.action !== "block" && report.action !== "safe_complete") return undefined;

  const decisive = report.checks
    .filter((check) => check.action === report.action)
    .map((check) => check.category);
  const category = primaryCategory(decisive.length ? decisive : report.triggeredCategories);

  if (category === "self_harm") return SELF_HARM_SAFE_COMPLETION;
  if (!category) return GENERIC_REFUSAL;
  return REFUSALS[category] ?? GENERIC_REFUSAL;
}

/** Disclaimers for `annotate` outcomes, prepended to the model's answer. */
export function buildDisclaimers(categories: HarmCategory[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const category of categories) {
    const disclaimer = DISCLAIMERS[category];
    if (disclaimer && !seen.has(disclaimer)) {
      seen.add(disclaimer);
      notes.push(disclaimer);
    }
  }
  return notes;
}

export { SELF_HARM_SAFE_COMPLETION };
