import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, reportViews } from "@/lib/schema";
import { hashedClientIdentity } from "@/lib/request-identity";

export function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Atomically reserve this report/IP/day view and increment analytics once. */
export async function recordUniqueReportView(
  slug: string,
  headers: Headers,
  now = new Date(),
): Promise<boolean> {
  const viewedOn = utcDateKey(now);
  const visitorHash = hashedClientIdentity(headers, `report-view:${slug}:${viewedOn}`);

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(reportViews)
      .values({ reportSlug: slug, visitorHash, viewedOn })
      .onConflictDoNothing()
      .returning({ reportSlug: reportViews.reportSlug });
    if (!inserted) return false;

    await tx
      .update(reports)
      .set({ viewCount: sql`${reports.viewCount} + 1` })
      .where(eq(reports.slug, slug));
    return true;
  });
}
