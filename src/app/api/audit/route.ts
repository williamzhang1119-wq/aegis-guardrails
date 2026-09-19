import { NextResponse } from "next/server";
import { auditSummary, readAudit } from "@/lib/guardrails/audit";
import { SESSION_HEADER } from "@/lib/protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const header = request.headers.get(SESSION_HEADER);
  const sessionId = header && /^[A-Za-z0-9_-]{6,64}$/.test(header) ? header : undefined;

  return NextResponse.json(
    {
      entries: readAudit(sessionId).slice(0, 50),
      summary: auditSummary(sessionId),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
