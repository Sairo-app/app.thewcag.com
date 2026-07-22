"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";
import { generateDeviceToken, hashToken } from "@/lib/device-auth";
import { isValidConnectState, normalizeDeviceName } from "./validation";
import { and, asc, eq, gt, isNull, lte } from "drizzle-orm";

const DEVICE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_ACTIVE_DEVICES = 10;

/**
 * Mint a device token for the signed-in user and return the deep link the
 * browser hands back to the desktop app. `state` is echoed so the app can
 * confirm it initiated this connection.
 */
export async function authorizeDevice(state: string, device: string): Promise<string> {
  if (!isValidConnectState(state)) {
    throw new Error("Invalid connection request. Start again from the desktop app.");
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const token = generateDeviceToken();
  const now = new Date();
  await db
    .update(desktopDevices)
    .set({ revokedAt: now })
    .where(and(
      eq(desktopDevices.userId, userId),
      isNull(desktopDevices.revokedAt),
      lte(desktopDevices.expiresAt, now),
    ));
  const activeDevices = await db
    .select({ id: desktopDevices.id })
    .from(desktopDevices)
    .where(and(
      eq(desktopDevices.userId, userId),
      isNull(desktopDevices.revokedAt),
      gt(desktopDevices.expiresAt, now),
    ))
    .orderBy(asc(desktopDevices.createdAt));
  if (activeDevices.length >= MAX_ACTIVE_DEVICES) {
    const revokeCount = activeDevices.length - MAX_ACTIVE_DEVICES + 1;
    for (const device of activeDevices.slice(0, revokeCount)) {
      await db.update(desktopDevices).set({ revokedAt: now }).where(eq(desktopDevices.id, device.id));
    }
  }
  await db.insert(desktopDevices).values({
    userId,
    tokenHash: hashToken(token),
    deviceName: normalizeDeviceName(device),
    expiresAt: new Date(now.getTime() + DEVICE_LIFETIME_MS),
  });

  const params = new URLSearchParams({ token, state });
  return `thewcag://auth?${params.toString()}`;
}
