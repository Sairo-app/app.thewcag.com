"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";
import { generateDeviceToken, hashToken } from "@/lib/device-auth";

/**
 * Mint a device token for the signed-in user and return the deep link the
 * browser hands back to the desktop app. `state` is echoed so the app can
 * confirm it initiated this connection.
 */
export async function authorizeDevice(state: string, device: string): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const token = generateDeviceToken();
  await db.insert(desktopDevices).values({
    userId,
    tokenHash: hashToken(token),
    deviceName: (device || "Desktop").slice(0, 80),
  });

  const params = new URLSearchParams({ token, state });
  return `thewcag://auth?${params.toString()}`;
}
