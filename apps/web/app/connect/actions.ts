"use server";

import { auth } from "@/auth";
import { createDeviceClaim } from "@/lib/device-claim";
import { isValidConnectState, normalizeDeviceName } from "./validation";

/**
 * Create a short-lived device claim for the signed-in user. The bearer token
 * does not exist until the desktop exchanges this one-time code.
 */
export async function authorizeDevice(state: string, device: string): Promise<string> {
  if (!isValidConnectState(state)) {
    throw new Error("Invalid connection request. Start again from the desktop app.");
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const code = await createDeviceClaim(userId, normalizeDeviceName(device));

  const params = new URLSearchParams({ code, state });
  return `thewcag://auth?${params.toString()}`;
}
