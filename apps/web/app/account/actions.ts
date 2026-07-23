"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { desktopDevices, reports } from "@/lib/schema";
import { deleteImageBestEffort } from "@/lib/r2";
import { cancelSubscriptionsBeforeAccountDeletion, deleteUserWithBillingTombstones } from "@/lib/billing/account-deletion";

export async function revokeDevice(deviceId: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || typeof deviceId !== "string" || deviceId.length > 100) return;
  await db
    .update(desktopDevices)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(desktopDevices.id, deviceId),
      eq(desktopDevices.userId, userId),
      isNotNull(desktopDevices.claimedAt),
      isNull(desktopDevices.revokedAt),
    ));
  revalidatePath("/account");
}

export async function revokeAllDevices(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await db
    .update(desktopDevices)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(desktopDevices.userId, userId),
      isNotNull(desktopDevices.claimedAt),
      isNull(desktopDevices.revokedAt),
    ));
  revalidatePath("/account");
}

export type DeleteAccountState = { error: string } | null;

export async function deleteOwnAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in again before deleting your account." };
  if (String(formData.get("confirmation") ?? "").trim() !== "DELETE MY ACCOUNT") {
    return { error: "Enter DELETE MY ACCOUNT exactly to confirm permanent deletion." };
  }

  try {
    await cancelSubscriptionsBeforeAccountDeletion(userId);
  } catch {
    return { error: "We could not cancel the active subscription, so the account was not deleted. Open Billing or try again." };
  }

  const storedReports = await db.select({ imageKey: reports.imageKey }).from(reports).where(eq(reports.userId, userId));
  const user = await deleteUserWithBillingTombstones(userId);
  await Promise.allSettled([
    ...storedReports.map((report) => deleteImageBestEffort(report.imageKey)),
    ...(user?.logoKey ? [deleteImageBestEffort(user.logoKey)] : []),
  ]);
  await signOut({ redirectTo: "/" });
  return null;
}
