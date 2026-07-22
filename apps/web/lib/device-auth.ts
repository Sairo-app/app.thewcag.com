import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";

export function generateDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface DeviceContext {
  userId: string;
  deviceId: string;
}

/** Resolve an `Authorization: Bearer <token>` header to the owning user. */
export async function verifyDeviceToken(authHeader: string | null): Promise<DeviceContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ id: desktopDevices.id, userId: desktopDevices.userId })
    .from(desktopDevices)
    .where(and(
      eq(desktopDevices.tokenHash, tokenHash),
      isNull(desktopDevices.revokedAt),
      gt(desktopDevices.expiresAt, new Date()),
    ))
    .limit(1);
  if (!row) return null;

  await db
    .update(desktopDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(desktopDevices.id, row.id))
    .catch(() => {});

  return { userId: row.userId, deviceId: row.id };
}
