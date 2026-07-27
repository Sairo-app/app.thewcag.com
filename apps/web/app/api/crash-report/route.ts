import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { crashReports } from "@/lib/schema";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import { parseCrashReportPayload } from "@/lib/crash-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A full report is a bounded name, message, and up to twelve capped frames.
const MAXIMUM_BODY_BYTES = 4_096;

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 415 });
  }

  let payload: ReturnType<typeof parseCrashReportPayload>;
  try {
    payload = parseCrashReportPayload(await readBoundedJson(request, MAXIMUM_BODY_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    // Identical crashes collapse onto one row so a widespread defect reads as a
    // count rather than as thousands of rows.
    await db
      .insert(crashReports)
      .values({
        fingerprint: payload.fingerprint,
        origin: payload.origin,
        name: payload.name,
        message: payload.message,
        frames: payload.frames,
        appVersion: payload.appVersion,
        platform: payload.platform,
        osRelease: payload.osRelease,
        arch: payload.arch,
      })
      .onConflictDoUpdate({
        target: crashReports.fingerprint,
        set: {
          count: sql`${crashReports.count} + 1`,
          lastSeenAt: sql`now()`,
          appVersion: payload.appVersion,
        },
      });
    return NextResponse.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
