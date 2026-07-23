import { and, asc, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";
import { DEVICE_TOKEN_LIFETIME_MS, generateDeviceToken, hashToken } from "@/lib/device-auth";

export const DEVICE_CLAIM_LIFETIME_MS = 10 * 60 * 1_000;
export const MAX_ACTIVE_DEVICES = 10;

const CLAIM_CODE = /^[a-f0-9]{64}$/;

type DeviceDatabase = typeof db;

export type DeviceClaimResult =
  | { status: "claimed"; token: string; expiresAt: Date }
  | { status: "expired" }
  | { status: "replayed" }
  | { status: "invalid" };

export function isValidDeviceClaimCode(value: unknown): value is string {
  return typeof value === "string" && CLAIM_CODE.test(value);
}

/** Create a pending, non-authenticating device row and return its one-time code. */
export async function createDeviceClaim(
  userId: string,
  deviceName: string,
  options: { now?: Date; database?: DeviceDatabase } = {},
): Promise<string> {
  const database = options.database ?? db;
  const now = options.now ?? new Date();
  const code = generateDeviceToken();
  await database.insert(desktopDevices).values({
    userId,
    deviceName,
    tokenHash: null,
    claimCodeHash: hashToken(code),
    claimExpiresAt: new Date(now.getTime() + DEVICE_CLAIM_LIFETIME_MS),
    claimedAt: null,
    expiresAt: null,
  });
  return code;
}

/** Atomically exchange a fresh one-time code for an active bearer token. */
export async function claimDevice(
  code: string,
  options: { now?: Date; database?: DeviceDatabase } = {},
): Promise<DeviceClaimResult> {
  if (!isValidDeviceClaimCode(code)) return { status: "invalid" };

  const database = options.database ?? db;
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + DEVICE_TOKEN_LIFETIME_MS);
  const claimCodeHash = hashToken(code);
  const token = generateDeviceToken();

  return database.transaction(async (tx) => {
    const [claimed] = await tx
      .update(desktopDevices)
      .set({ tokenHash: hashToken(token), claimedAt: now, expiresAt })
      .where(and(
        eq(desktopDevices.claimCodeHash, claimCodeHash),
        isNull(desktopDevices.claimedAt),
        isNull(desktopDevices.revokedAt),
        gt(desktopDevices.claimExpiresAt, now),
      ))
      .returning({ id: desktopDevices.id, userId: desktopDevices.userId });

    if (!claimed) {
      const [existing] = await tx
        .select({
          claimedAt: desktopDevices.claimedAt,
          claimExpiresAt: desktopDevices.claimExpiresAt,
        })
        .from(desktopDevices)
        .where(eq(desktopDevices.claimCodeHash, claimCodeHash))
        .limit(1);
      if (existing?.claimedAt) return { status: "replayed" };
      if (existing?.claimExpiresAt && existing.claimExpiresAt.getTime() <= now.getTime()) {
        return { status: "expired" };
      }
      return { status: "invalid" };
    }

    // Serialize limit enforcement per account. Concurrent claims may update
    // before taking this lock, but the later transaction sees the earlier
    // commit before it counts and evicts.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${claimed.userId}))`);
    await tx
      .update(desktopDevices)
      .set({ revokedAt: now })
      .where(and(
        eq(desktopDevices.userId, claimed.userId),
        isNotNull(desktopDevices.claimedAt),
        isNull(desktopDevices.revokedAt),
        lte(desktopDevices.expiresAt, now),
      ));

    const activeDevices = await tx
      .select({ id: desktopDevices.id })
      .from(desktopDevices)
      .where(and(
        eq(desktopDevices.userId, claimed.userId),
        isNotNull(desktopDevices.claimedAt),
        isNull(desktopDevices.revokedAt),
        gt(desktopDevices.expiresAt, now),
      ))
      .orderBy(asc(desktopDevices.claimedAt), asc(desktopDevices.createdAt));

    const revokeCount = Math.max(0, activeDevices.length - MAX_ACTIVE_DEVICES);
    for (const device of activeDevices.slice(0, revokeCount)) {
      await tx
        .update(desktopDevices)
        .set({ revokedAt: now })
        .where(eq(desktopDevices.id, device.id));
    }

    return { status: "claimed", token, expiresAt };
  });
}
