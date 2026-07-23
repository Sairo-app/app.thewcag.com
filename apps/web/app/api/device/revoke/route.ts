import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke the bearer token used for this request. */
export async function DELETE(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db
    .update(desktopDevices)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(desktopDevices.id, ctx.deviceId),
      isNotNull(desktopDevices.claimedAt),
    ));
  return NextResponse.json({ revoked: true });
}
