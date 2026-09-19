import { NextResponse } from "next/server";
import { runDailyCheckup } from "@/lib/guardrails/checkup";
import { describeProvider, selectProvider } from "@/lib/model/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const token = process.env.CHECKUP_TOKEN?.trim();
  if (!token) return true;
  const header = request.headers.get("x-checkup-token")?.trim();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return header === token || bearer === token;
}

/**
 * Runs the daily guardrail contract against this process.
 * Set CHECKUP_TOKEN to require a header before anyone can hit it.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const report = runDailyCheckup();
  const provider = describeProvider(selectProvider());
  return NextResponse.json(
    {
      ...report,
      provider: provider.id,
      model: provider.model,
    },
    {
      status: report.ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
