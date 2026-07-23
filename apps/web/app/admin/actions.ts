"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { deleteImageBestEffort } from "@/lib/r2";
import { requireAdmin } from "@/lib/admin";
import { cancelSubscriptionsBeforeAccountDeletion, deleteUserWithBillingTombstones } from "@/lib/billing/account-deletion";
import type { AdminActionResult } from "@/lib/admin-action";

/** Admin: delete a published report (revokes the public link + R2 object). */
export async function adminDeleteReport(slug: string): Promise<AdminActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, reason: "Admin authorization expired. Reload and sign in again." };
  }
  const [row] = await db
    .delete(reports)
    .where(eq(reports.slug, slug))
    .returning({ imageKey: reports.imageKey });
  if (!row) return { ok: false, reason: "The report no longer exists." };
  if (row?.imageKey) await deleteImageBestEffort(row.imageKey);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return { ok: true };
}

/** Admin: delete a user account entirely. Cascades sessions, devices, and
 *  reports in the DB; purges their report images and brand logo from R2.
 *  Admins cannot delete themselves (guard against locking yourself out). */
export async function adminDeleteUser(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, reason: "Admin authorization expired. Reload and sign in again." };
  }
  if (admin.userId === userId) {
    return { ok: false, reason: "You cannot delete your own admin account." };
  }

  try {
    await cancelSubscriptionsBeforeAccountDeletion(userId, "merchant");
  } catch (error) {
    console.error("Admin user deletion stopped because billing cancellation failed", {
      userId,
      code: error instanceof Error ? error.name : "unknown_billing_error",
    });
    return {
      ok: false,
      reason: "Paid subscription cancellation failed. The user was not deleted.",
    };
  }

  const rows = await db
    .select({ imageKey: reports.imageKey })
    .from(reports)
    .where(eq(reports.userId, userId));
  const user = await deleteUserWithBillingTombstones(userId);
  if (!user) return { ok: false, reason: "The user no longer exists." };

  // Best-effort R2 cleanup after the DB delete succeeds.
  await Promise.allSettled([
    ...rows.map((r) => deleteImageBestEffort(r.imageKey)),
    ...(user?.logoKey ? [deleteImageBestEffort(user.logoKey)] : []),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}
