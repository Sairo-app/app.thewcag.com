import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { STORAGE_QUOTA_BYTES, userStorageBytes } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The desktop app polls this with its Keychain token to learn who it is. */
export async function GET(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ signedIn: false }, { status: 401 });

  const [[user], usedBytes] = await Promise.all([
    db.select({ email: users.email }).from(users).where(eq(users.id, ctx.userId)).limit(1),
    userStorageBytes(ctx.userId),
  ]);

  return NextResponse.json({
    signedIn: true,
    email: user?.email ?? "",
    features: { publishReports: true },
    storage: { usedBytes, quotaBytes: STORAGE_QUOTA_BYTES },
  });
}
