import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VerdictBadge } from "@/components/safety/verdict-badge";
import { CATEGORY_META, DEFAULT_POLICY, NON_NEGOTIABLE } from "@/lib/guardrails/policy";
import { CATEGORY_RULES } from "@/lib/guardrails/rules";
import { INJECTION_SIGNATURES } from "@/lib/guardrails/checks/prompt-injection";
import { SAFETY_PRINCIPLES } from "@/lib/model/system-prompt";
import type { HarmCategory } from "@/lib/guardrails/types";

export const metadata: Metadata = {
  title: "Safety policy — Venture 1",
  description:
    "The full guardrail specification: pipeline order, category taxonomy, thresholds, actions, and the limitations of the approach.",
};

const GROUP_TITLES: Record<string, string> = {
  harm: "Physical harm",
  abuse: "Abuse & hate",
  privacy: "Privacy",
  integrity: "System integrity",
};

const PIPELINE_STAGES = [
  {
    stage: "1",
    title: "Transport limits",
    body: "Per-session rate limit and per-message and per-conversation size caps. These run first because they cost nothing and they stop abuse before a single token is billed. A gate failure short-circuits the rest of the pipeline.",
  },
  {
    stage: "2",
    title: "Injection detection & neutralisation",
    body: "Invisible characters are stripped, then eight signature families are scored. A hit does not refuse the turn — the span is wrapped in untrusted-content markers with an in-band instruction that it is data, and the answer proceeds.",
  },
  {
    stage: "3",
    title: "Secret & PII redaction",
    body: "Credentials and personal data are replaced with numbered placeholders before the model receives the text. Card numbers are Luhn-validated and private IP ranges are ignored, so ordinary messages are not mangled.",
  },
  {
    stage: "4",
    title: "Harm classification",
    body: "The sanitised text is scored against the category taxonomy below. A category only scores if a topic trigger fires; operational intent raises the score and credible benign context lowers it.",
  },
  {
    stage: "5",
    title: "Model call under a system prompt",
    body: "The behavioural layer. Advisory by design — a determined prompt will eventually talk any model out of its instructions, which is why deterministic checks bracket it on both sides.",
  },
  {
    stage: "6",
    title: "Output filtering",
    body: "The draft goes through the same taxonomy plus system-prompt-disclosure and credential-emission checks. During streaming, the tail of the buffer is withheld until it has been scanned, and a late violation retracts the whole message.",
  },
  {
    stage: "7",
    title: "Audit",
    body: "Each verdict is recorded with a content hash, length, categories, action, and latency. Message bodies are not stored unless privacy-preserving mode is explicitly turned off.",
  },
];

const LIMITATIONS = [
  {
    title: "Pattern matching has a ceiling",
    body: "These are regex-and-weight classifiers: fast, free, explainable, and unit-testable. They will also miss novel phrasings, most non-English text, and determined obfuscation. A production deployment layers a trained moderation classifier alongside them — the architecture treats that as one more check rather than a rewrite.",
  },
  {
    title: "Thresholds are judgement calls",
    body: "Every number on this page is a defensible starting point, not a measured optimum. Tuning them properly needs a labelled evaluation set drawn from your own traffic, and each one trades false positives against false negatives.",
  },
  {
    title: "The rate limiter is per-instance",
    body: "It lives in process memory, so it holds for one server process. A multi-instance deployment needs shared state such as Redis or the hosting platform's own limiter.",
  },
  {
    title: "The audit log is ephemeral",
    body: "A 200-entry ring buffer in memory that clears on restart. Real deployments need durable, access-controlled storage with a retention policy — and that storage is a privacy liability worth designing deliberately.",
  },
  {
    title: "Refusal is not the same as safety",
    body: "A system that refuses everything scores perfectly on harm and is useless. The mitigator patterns exist because unnecessary refusals are treated as defects here, and the dual-use probes in the app are there to keep that honest.",
  },
];

function CategoryRow({ id }: { id: HarmCategory }) {
  const meta = CATEGORY_META[id];
  const policy = DEFAULT_POLICY.categories[id];
  const rule = CATEGORY_RULES.find((entry) => entry.id === id);
  const locked = NON_NEGOTIABLE.includes(id);

  return (
    <div className="border-t py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{meta.title}</h3>
        <VerdictBadge action={policy.maxAction} className="text-[10px]" />
        <Badge variant="secondary" className="font-mono text-[10px]">
          threshold {policy.threshold.toFixed(2)}
        </Badge>
        {locked && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Lock className="size-2.5" aria-hidden />
            locked
          </Badge>
        )}
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">{meta.description}</p>
      <p className="mt-1.5 text-sm">{meta.reasoning}</p>

      {rule && (
        <dl className="mt-2.5 grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Topic triggers</dt>
            <dd className="font-mono">{rule.triggers.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Intent intensifiers</dt>
            <dd className="font-mono">{rule.intensifiers?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Benign-context mitigators</dt>
            <dd className="font-mono">{rule.mitigators?.length ?? 0}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default function SafetyPage() {
  const grouped = Object.values(CATEGORY_META).reduce<Record<string, HarmCategory[]>>(
    (accumulator, meta) => {
      accumulator[meta.group] = [...(accumulator[meta.group] ?? []), meta.id];
      return accumulator;
    },
    {},
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to chat
      </Link>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Safety policy</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        This is the whole specification, generated from the same modules the running pipeline uses — so
        it cannot drift out of date. Policy version{" "}
        <span className="font-mono text-foreground">{DEFAULT_POLICY.version}</span>, with{" "}
        {Object.keys(CATEGORY_META).length} categories.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">How a turn is processed</h2>
        <ol className="mt-4 space-y-3">
          {PIPELINE_STAGES.map((stage) => (
            <li key={stage.stage} className="flex gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-[11px]"
              >
                {stage.stage}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{stage.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Scoring model</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Each category is a weighted pattern set in three layers. Topic triggers establish that the
          category is in play at all — nothing scores without one, so intent markers alone never
          convict. Intensifiers add weight when a request looks operational rather than curious.
          Mitigators subtract it when there is credible benign context. The result is clamped to 0–1 and
          compared against the category threshold.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This is what separates <em>how does ransomware spread</em> from{" "}
          <em>write me working ransomware</em> without refusing the first one. Every contribution is
          reported as evidence, which is why the inspector in the chat can show you the arithmetic
          behind any verdict.
        </p>

        <Card className="mt-5">
          <CardHeader>
            <CardTitle className="text-sm">Actions, from least to most restrictive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {(
              [
                ["allow", "Passes through untouched."],
                ["annotate", "Answered, with a disclaimer prepended. Used for regulated advice and dosing."],
                ["redact", "Text is rewritten: placeholders substituted, or the span quarantined as untrusted data."],
                ["safe_complete", "Written supportive copy replaces generation. Used only for self-harm."],
                ["block", "Model is never called, or its draft is withheld. Written refusal copy is returned."],
              ] as const
            ).map(([action, description]) => (
              <div key={action} className="flex flex-wrap items-baseline gap-2">
                <VerdictBadge action={action} className="text-[10px]" />
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Category taxonomy</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Three categories are non-negotiable: child safety, weapons of mass harm, and self-harm. The
          server discards any override that touches them, so a client cannot weaken them by editing a
          request — the toggles in the app are genuinely inert rather than merely hidden.
        </p>

        {Object.entries(grouped).map(([group, ids]) => (
          <div key={group} className="mt-7">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUP_TITLES[group] ?? group}
            </h3>
            <div className="mt-2">
              {ids.map((id) => (
                <CategoryRow key={id} id={id} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Behavioural principles</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The system prompt given to the model. It is published here on purpose: the model refuses to
          recite it and the output guard blocks it if it tries, but security through obscurity is not
          the point — the deterministic checks are what actually hold.
        </p>
        <ol className="mt-4 space-y-3">
          {SAFETY_PRINCIPLES.map((principle, index) => (
            <li key={principle.id} className="flex gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-[11px]"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{principle.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{principle.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Injection signatures</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The {INJECTION_SIGNATURES.length} signature families the injection detector scores, with their
          weights. Detection leads to quarantine rather than refusal, so a flagged message still gets an
          answer.
        </p>
        <ul className="mt-4 space-y-1.5">
          {INJECTION_SIGNATURES.map((signature) => (
            <li key={signature.label} className="flex items-baseline justify-between gap-4 text-sm">
              <span>{signature.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                +{signature.weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Limits of this approach</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A safety page that only lists strengths is marketing. These are the things this system does
          not do.
        </p>
        <dl className="mt-4 space-y-4">
          {LIMITATIONS.map((limitation) => (
            <div key={limitation.title}>
              <dt className="text-sm font-semibold">{limitation.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{limitation.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Separator className="my-10" />

      <section className="rounded-xl border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">If you are in crisis</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is a demonstration application and not a substitute for help from a person. In the US and
          Canada call or text <span className="font-semibold text-foreground">988</span>. In the UK and
          Ireland call <span className="font-semibold text-foreground">116 123</span>. In Australia call{" "}
          <span className="font-semibold text-foreground">13 11 14</span>. Elsewhere,{" "}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            findahelpline.com
          </a>{" "}
          lists free, confidential services by country.
        </p>
      </section>
    </div>
  );
}
