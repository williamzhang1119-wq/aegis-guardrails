#!/usr/bin/env node
/**
 * Hits a deployed instance: liveness, guardrail contract, then one chat turn.
 * Used by the daily GitHub Action. Requires CHECKUP_URL (origin, no trailing path).
 */

const base = (process.env.CHECKUP_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("CHECKUP_URL is required, e.g. https://venture-1.up.railway.app");
  process.exit(1);
}

const headers = { accept: "application/json" };
const token = process.env.CHECKUP_TOKEN?.trim();
if (token) headers["x-checkup-token"] = token;

async function getJson(path) {
  const response = await fetch(`${base}${path}`, { headers, redirect: "follow" });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }
  return { status: response.status, body };
}

const health = await getJson("/api/health");
if (health.status !== 200 || health.body?.ok !== true) {
  console.error("health failed", health);
  process.exit(1);
}
console.log(`health ok  provider=${health.body.provider}  model=${health.body.model}`);

const checkup = await getJson("/api/checkup");
if (checkup.status !== 200 || checkup.body?.ok !== true) {
  console.error("checkup failed", JSON.stringify(checkup.body, null, 2));
  process.exit(1);
}
console.log(`checkup ok  ${checkup.body.passed} passed  ${checkup.body.failed} failed`);

const chatHeaders = {
  "content-type": "application/json",
  "x-venture-session": "daily-checkup",
};
const chat = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: chatHeaders,
  body: JSON.stringify({
    messages: [
      {
        role: "user",
        content: "What's a good way to structure a Postgres migration for a large table?",
      },
    ],
  }),
});

if (!chat.ok) {
  console.error(`chat HTTP ${chat.status}`);
  process.exit(1);
}

const stream = await chat.text();
const events = stream
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const input = events.find((event) => event.type === "input_report");
const done = events.some((event) => event.type === "done");
const error = events.find((event) => event.type === "error");

if (error) {
  console.error("chat error event", error);
  process.exit(1);
}
if (!input || input.report?.action === "block") {
  console.error("chat input was blocked or missing", input);
  process.exit(1);
}
if (!done) {
  console.error("chat stream did not finish");
  process.exit(1);
}

console.log(`chat ok  action=${input.report.action}  events=${events.length}`);
console.log("daily checkup passed");
