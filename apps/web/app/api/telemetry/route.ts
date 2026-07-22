import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { funnelTransitions } from "@/lib/schema";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import { parseFunnelTelemetryPayload } from "@/lib/funnel-telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_BODY_BYTES = 128;

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 415 });
  }

  let payload: ReturnType<typeof parseFunnelTelemetryPayload>;
  try {
    payload = parseFunnelTelemetryPayload(await readBoundedJson(request, MAXIMUM_BODY_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await db
      .insert(funnelTransitions)
      .values({ event: payload.event })
      .onConflictDoUpdate({
        target: funnelTransitions.event,
        set: { count: sql`${funnelTransitions.count} + 1` },
      });
    return NextResponse.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
