import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { resolveEntitlements } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The desktop app polls this with its Keychain token to learn who it is. */
export async function GET(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ signedIn: false }, { status: 401 });

  const [[user], entitlements] = await Promise.all([
    db.select({ email: users.email }).from(users).where(eq(users.id, ctx.userId)).limit(1),
    resolveEntitlements(ctx.userId),
  ]);

  return NextResponse.json({
    signedIn: true,
    email: user?.email ?? "",
    ...entitlements,
    features: {
      ...entitlements.features,
      publishReports: entitlements.features.hostedReports.enabled,
      aiFindingDrafts: entitlements.features.managedAi.enabled && Boolean(process.env.OPENAI_API_KEY),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
