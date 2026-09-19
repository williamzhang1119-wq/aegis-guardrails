# Venture 1 — an AI assistant with visible safety guardrails

A chat assistant wrapped in a deterministic safety pipeline, built so you can watch the pipeline work
on every turn — including the turns where it decides to let you through.

Most safety layers are invisible. You send a message, and either you get an answer or you get "I
can't help with that," with no way to know which check fired, what it scored, or whether it was even
right. This project inverts that: every message is inspectable, every score is shown with the
patterns that produced it, and the policy that governs it all is a plain TypeScript module you can
read in one sitting.

**It runs with no API key.** An offline rule-based responder stands in for the model so the guardrails
can be exercised end to end out of the box. Add an OpenAI or Anthropic key and the identical pipeline
wraps a real model.

## Quick start

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:43117.

```bash
npm test          # 77 tests across the guardrail pipeline
npm run lint      # eslint
npm run build     # production build
```

Optional — put a real model behind the guardrails:

```bash
cp .env.example .env.local   # add OPENAI_API_KEY or ANTHROPIC_API_KEY
```

## Publish

This is a Next.js app with server routes (`/api/chat`, `/api/audit`), not a static site
and not an npm package. "Publish" means deploy it to a Node host.

The finished path is **GitHub + Railway**. Railway builds the `Dockerfile`,
serves on `$PORT`, and health-checks `/api/health`. GitHub Actions runs the
guardrail suite on every push and again every day. Render and Vercel remain
documented below as alternatives.

Without API keys the deployed app still works. It uses the offline responder,
same as local `npm run dev`.

### 1. Push the repo to GitHub

Railway (and GitHub Actions) cannot read Cursor Origin. Create an empty GitHub
repo — `williamzhang1119-wq/aegis-guardrails` is the public copy of this project — then from a clone:

```bash
git remote add github https://github.com/williamzhang1119-wq/aegis-guardrails.git
git push -u github main
```

Keep Origin as `origin` if you want; GitHub is a second remote. After this,
every file in the repo — Dockerfile, `railway.json`, workflows, checkup
routes — is what Railway and Actions will use. Do not add `.env.local`.

### 2. Deploy on Railway

1. Create an account at [https://railway.com](https://railway.com) and connect GitHub.
2. **New Project → Deploy from GitHub repo** → `williamzhang1119-wq/aegis-guardrails` → `main`.
3. Railway sees the `Dockerfile` and builds it. Wait until the deploy is active.
4. Open the service → **Settings → Networking → Generate Domain**. That URL is
   the public app.
5. In **Settings → Deploy**, set **Healthcheck Path** to `/api/health` if it is
   not already picked up from `railway.json`.
6. Optional live model: **Variables** → `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
   (names in `.env.example`). Redeploy after saving.

CLI equivalent, once the GitHub repo exists:

```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway domain
```

### 3. Daily checkups for the AI

The contract lives in `src/lib/guardrails/checkup.ts` — baseline allowed,
dual-use not blocked, operational harm refused, self-harm safe-completed,
child safety blocked. Three ways it runs:

| When | What |
| --- | --- |
| `npm run checkup` | Same 12 cases against the local pipeline |
| `GET /api/checkup` | Same cases on the running server (HTTP 503 if any fail) |
| GitHub Action **Daily AI checkup** | `npm run checkup` plus `npm test` at 13:00 UTC, and a live hit of `/api/health`, `/api/checkup`, and one chat turn if `CHECKUP_URL` is set |

Turn on the live probe after Railway has a public URL:

1. GitHub repo → **Settings → Secrets and variables → Actions**.
2. Repository secret `CHECKUP_URL` = `https://<your-service>.up.railway.app` (no trailing slash).
3. Optional secret `CHECKUP_TOKEN` — if you also set `CHECKUP_TOKEN` on the Railway service, `/api/checkup` requires `x-checkup-token`.
4. **Actions → Daily AI checkup → Run workflow** once to confirm.

`/api/health` is liveness only (Railway polls it). `/api/checkup` is the
full guardrail contract and is not used as the deploy healthcheck.

```bash
npm run checkup                          # local
CHECKUP_URL=https://… npm run checkup:live
```

### Render

`render.yaml` at the repo root is the Blueprint Render uses. The app deploys as a
**Web Service**, not a static site. It also needs the GitHub copy from step 1.

1. Create a free account at [https://dashboard.render.com/register](https://dashboard.render.com/register). Signing up with GitHub is the shortest path, because that also connects the repo source.
2. In the Render dashboard: **New + → Blueprint**.
3. Pick the GitHub repo that contains this project and the `main` branch.
4. Render reads `render.yaml` and creates **venture-1** on the **free** plan. Confirm and apply.
5. Wait for the first build. When it is live, the service page shows a URL like `https://venture-1.onrender.com`.
6. Open that URL. Free instances sleep after about 15 minutes of idle traffic; the next visit can take a minute to wake.

Alternative without a Blueprint: **New + → Web Service** → the same repo → build `npm ci && npm run build`, start `npm start`, instance **Free**. Health check path: `/api/health`.

Do not add API keys until the site loads. Optional keys are `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` under the service **Environment** tab; trigger a manual deploy after saving.

### Vercel CLI

Works from this repo as it stands — including when the only remote is Origin,
which Vercel cannot import from Git.

1. Create a [Vercel](https://vercel.com) account.
2. From the project root:

```bash
npx vercel login
npx vercel
```

The first `npx vercel` creates a preview deployment and a project. When the
preview looks right:

```bash
npx vercel --prod
```

That prints a `*.vercel.app` URL. Later production deploys are the same command.

3. To wrap a live model, add keys in the Vercel project:
   **Settings → Environment Variables**. Use the names in `.env.example`
   (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, plus optional `OPENAI_MODEL` /
   `ANTHROPIC_MODEL`). Scope them to Production (and Preview if you want
   previews to hit a real model too). Redeploy after adding them —
   `npx vercel --prod` — or they will not be present at runtime.

### Auto-deploy on every push (Vercel)

If you want `main` to publish itself on Vercel after the GitHub remote exists:

1. [Import the project](https://vercel.com/new). Leave the Next.js defaults
   (build command `next build`, Node 22).
2. Add the same environment variables before the first production deploy.
3. After that, every push to `main` publishes production; every other branch
   gets a preview URL.

### Self-host

Any host that can run a Node 22+ process works:

```bash
npm ci
npm run build
npm start          # binds 0.0.0.0, listens on PORT (default 3000)
```

Set the same environment variables in that host's secret store. Do not commit
`.env.local`.

### What changes in production

The README limitations still apply, and two of them get sharper on a hosted
deploy:

- The rate limiter and the 200-entry audit log live in **process memory**. On
  Vercel that is one serverless instance — a new instance, a cold start, or a
  second replica starts empty. On Railway or Render it is one long-lived
  process while the instance is awake, but a restart or a free-plan sleep
  still clears it. Fine for a demo; not fine if you need a real abuse budget
  or an audit trail that survives a restart.
- `/api/chat` is `dynamic` and streams. Do not switch the project to a static
  export — the chat endpoint would disappear.

## What the guardrails actually do

Every turn makes two passes through the pipeline, and the model is treated as untrusted on both
sides. The stage order is deliberate.

| # | Stage | Behaviour |
|---|-------|-----------|
| 1 | Transport limits | Per-session rate limit and message/conversation size caps. Runs first because it costs nothing and stops abuse before a token is billed. |
| 2 | Injection detection | Strips invisible characters, scores eight signature families, and **quarantines rather than refuses** — the span is relabelled as untrusted data and the turn continues. |
| 3 | Secret & PII redaction | Credentials and personal data are replaced with placeholders before the model receives the text. |
| 4 | Harm classification | 19 categories scored on the sanitised text. |
| 5 | Model call | Under a published system prompt. Advisory by design. |
| 6 | Output filtering | The draft goes through the same taxonomy plus system-prompt-disclosure and credential-emission checks. |
| 7 | Audit | Verdict, hash, categories, and latency recorded. Message bodies are not stored by default. |

The full specification — every category, threshold, action, and known limitation — is rendered at
`/safety` directly from the same modules the pipeline uses, so it cannot drift out of date.

## The parts worth reading

### Scoring is three-layered, so refusals stay narrow

A category only scores if a **topic trigger** fires. **Intensifiers** raise the score when a request
looks operational (`step by step`, `full working code`, `undetectable`). **Mitigators** lower it when
there is credible benign context (`how do I defend against`, `for my thesis`, `my own lab`,
`is this legal`).

This is what separates *how does ransomware spread* from *write me working ransomware* without
refusing the first one. An unnecessary refusal is treated as a defect here, and the dual-use probes
in the app exist to keep that honest.

See `src/lib/guardrails/rules.ts` and `src/lib/guardrails/scoring.ts`.

### A mention is not a delivery

Applying the input rules unchanged to model output produces nonsense: an answer explaining how
ransomware spreads scores as if it *were* ransomware. So the output phase asks a different question —
does this text *deliver* the harm? Sequenced instructions, quantities, reagents, an executable
payload. A bare topic mention is discounted to 35%, and copy that is refusing or explaining the
safety system is discounted further.

Child safety is exempt from that discount. There is no framing in which that content is a mere
mention.

See `adjustForOutput` in `src/lib/guardrails/checks/classifier.ts`.

### Streaming output filtering is a real trade-off

You cannot unsay a token someone has already read. Two mechanisms handle it:

- **Holdback** — the tail of the buffer is withheld from display until more text arrives, so a
  violation completing inside the tail is caught before any of it renders. The cost is latency.
- **Retraction** — every scan runs against the whole accumulated draft, not just the newest chunk, so
  a pattern straddling a chunk boundary is still found. A late violation aborts the stream and the
  client discards the partial message.

Turn the holdback off in the Policy controls and watch the difference. Making the trade visible beats
hiding it. See `src/lib/guardrails/streaming.ts`.

### Refusals are written, not generated

Three rules: name what is withheld, do not moralise, always leave the legitimate door open. A refusal
that reads like a compliance notice teaches people to route around the system, which makes it *less*
safe. Self-harm is not a refusal at all — it is a safe completion that stays with the person, withholds
method information, surfaces real crisis lines, and keeps the conversation open.

See `src/lib/guardrails/responses.ts`.

### Three categories cannot be weakened

Child safety, weapons of mass harm, and self-harm are non-negotiable. `resolvePolicy` discards any
override that touches them, and limit overrides are clamped, so a hand-crafted request cannot hand
itself an unlimited budget. The toggles in the UI for those categories are genuinely inert rather than
merely hidden — there is a test for it.

### Safety logs are a privacy liability

The most sensitive messages a user ever sends are exactly the ones a naive implementation writes to
disk in full. The audit log stores a SHA-256 prefix, length, categories, action, and latency by
default — enough to audit behaviour and tune thresholds, without retaining the message. Storing
previews is a visible, deliberate toggle.

## Project layout

```
src/
  app/
    api/chat/route.ts        Streaming NDJSON endpoint; orchestrates the pipeline
    api/audit/route.ts       Session-scoped audit log
    page.tsx                 Chat workbench
    safety/page.tsx          Generated policy specification
  lib/
    guardrails/
      types.ts               Severity, actions, reports; action-merging rules
      policy.ts              Category metadata, thresholds, non-negotiables
      rules.ts               Pattern sets: triggers, intensifiers, mitigators
      scoring.ts             The three-layer scoring model
      pipeline.ts            Stage sequencing for input and output
      streaming.ts           Holdback and retraction
      responses.ts           Refusal and safe-completion copy
      audit.ts               Privacy-preserving decision log
      checks/                pii, secrets, prompt-injection, limits, classifier,
                             system-prompt-leak
      __tests__/             77 tests
    model/
      system-prompt.ts       Published behavioural principles
      provider.ts            Key-based provider selection
      local.ts               Offline fallback responder
      remote.ts              OpenAI and Anthropic SSE adapters
  components/
    chat/                    Workbench, message bubbles, composer, probe deck
    safety/                  Report inspector, policy panel, activity panel
  hooks/use-guarded-chat.ts  Stream consumption and message state
```

## Honest limitations

A safety document that only lists strengths is marketing. These matter if you plan to build on this.

- **Pattern matching has a ceiling.** These are regex-and-weight classifiers: fast, free, explainable,
  unit-testable — and they will miss novel phrasings, most non-English text, and determined
  obfuscation. A production deployment layers a trained moderation classifier alongside them. The
  architecture treats that as one more `Check` rather than a rewrite.
- **The system prompt is advisory.** A determined prompt will eventually talk any model out of its
  instructions. That is precisely why the deterministic checks bracket it on both sides.
- **Thresholds are judgement calls,** not measured optima. Tuning them needs a labelled evaluation set
  drawn from your own traffic.
- **The rate limiter is per-instance** (process memory). Multiple instances need shared state such as
  Redis or the platform's own limiter.
- **The audit log is a 200-entry in-memory ring buffer** that clears on restart. Real deployments need
  durable, access-controlled storage with a retention policy.
- **The offline fallback responder is not a language model.** It is an intent router over written copy.
  It says so in the UI rather than pretending otherwise.

## If you are in crisis

This is a demonstration application, not a substitute for help from a person. In the US and Canada
call or text **988**. In the UK and Ireland call **116 123**. In Australia call **13 11 14**.
Elsewhere, [findahelpline.com](https://findahelpline.com) lists free, confidential services by
country.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Vitest
