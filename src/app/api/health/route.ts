import { NextResponse } from "next/server";
import { describeProvider, selectProvider } from "@/lib/model/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Railway / Render / any load balancer.
 * Cheap on purpose: it must not run the checkup suite.
 */
export async function GET() {
  const provider = describeProvider(selectProvider());
  return NextResponse.json(
    {
      ok: true,
      service: "venture-1",
      provider: provider.id,
      model: provider.model,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
