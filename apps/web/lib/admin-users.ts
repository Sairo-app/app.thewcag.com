import { and, desc, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingSubscriptions, desktopDevices, reports } from "@/lib/schema";

export async function loadAdminUserDecorations(userIds: string[]) {
  if (userIds.length === 0) {
    return { reportAgg: [], deviceAgg: [], subscriptionRows: [] };
  }

  const [reportAgg, deviceAgg, subscriptionRows] = await Promise.all([
    db
      .select({
        userId: reports.userId,
        n: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${reports.sizeBytes}), 0)::bigint`,
      })
      .from(reports)
      .where(inArray(reports.userId, userIds))
      .groupBy(reports.userId),
    db
      .select({ userId: desktopDevices.userId, n: sql<number>`count(*)::int` })
      .from(desktopDevices)
      .where(and(
        inArray(desktopDevices.userId, userIds),
        isNull(desktopDevices.revokedAt),
        gt(desktopDevices.expiresAt, new Date()),
      ))
      .groupBy(desktopDevices.userId),
    db
      .select({
        userId: billingSubscriptions.userId,
        status: billingSubscriptions.status,
        updatedAt: billingSubscriptions.updatedAt,
      })
      .from(billingSubscriptions)
      .where(inArray(billingSubscriptions.userId, userIds))
      .orderBy(desc(billingSubscriptions.updatedAt)),
  ]);

  return { reportAgg, deviceAgg, subscriptionRows };
}
