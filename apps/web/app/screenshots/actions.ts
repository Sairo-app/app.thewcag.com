"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { deleteImage } from "@/lib/r2";

/** Delete a shared screenshot the signed-in user owns (image + metadata). */
export async function deleteScreenshot(slug: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const [row] = await db
    .select({ imageKey: reports.imageKey })
    .from(reports)
    .where(and(eq(reports.slug, slug), eq(reports.userId, userId)))
    .limit(1);
  if (!row) return;

  await deleteImage(row.imageKey);
  await db.delete(reports).where(and(eq(reports.slug, slug), eq(reports.userId, userId)));
  revalidatePath("/screenshots");
}
