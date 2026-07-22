import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { reconcileBillingAndRetention } from "@/lib/billing/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(header: string | null): boolean {
  const secret = process.env.BILLING_RECONCILE_SECRET?.trim();
  const supplied = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function run(req: NextRequest) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await reconcileBillingAndRetention();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
