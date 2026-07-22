import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveEntitlements } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await resolveEntitlements(session.user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
