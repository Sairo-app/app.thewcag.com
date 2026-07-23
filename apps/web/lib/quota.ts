import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { reports } from "./schema";

/** Sum of all image bytes this user currently has stored. */
export async function userStorageBytes(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${reports.sizeBytes}), 0)` })
    .from(reports)
    .where(eq(reports.userId, userId));
  return Number(row?.total ?? 0);
}

/** Human-readable size, e.g. 1.0 GB / 240 MB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
