import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { decodePngBase64, generateSlug, isUniqueViolation, sanitizeReportIssues, SITE_URL } from "@/lib/reports";
import { deleteImage, putImage } from "@/lib/r2";
import { STORAGE_QUOTA_BYTES, formatBytes, userStorageBytes } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class StorageQuotaError extends Error {
  constructor(public readonly usedBytes: number) {
    super("storage quota exceeded");
  }
}

function quotaResponse(usedBytes: number) {
  return NextResponse.json(
    {
      error: "storage_quota_exceeded",
      message: `Image storage limit reached (${formatBytes(usedBytes)} of ${formatBytes(STORAGE_QUOTA_BYTES)} used). Delete some shared screenshots to free space.`,
      usedBytes,
      quotaBytes: STORAGE_QUOTA_BYTES,
    },
    { status: 413 },
  );
}

/** Publish an annotated screenshot: image to R2, metadata to Postgres. */
export async function POST(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const b = body as { title?: string; description?: string; issues?: unknown; imageBase64?: string };

  const decoded = decodePngBase64(String(b.imageBase64 ?? ""));
  if (!decoded.ok) {
    return NextResponse.json({ error: decoded.error }, { status: decoded.error === "image too large" ? 413 : 400 });
  }

  const title = (typeof b.title === "string" ? b.title.trim() : "").slice(0, 140) || "Accessibility screenshot";
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 500) : null;
  const issues = sanitizeReportIssues(b.issues);

  // Per-user 1 GiB image cap: reject before writing anything to R2.
  const used = await userStorageBytes(ctx.userId);
  if (used + decoded.buffer.length > STORAGE_QUOTA_BYTES) {
    return quotaResponse(used);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const imageKey = `screenshots/${slug}.png`;
    try {
      await putImage(imageKey, decoded.buffer, "image/png");
      await db.transaction(async (tx) => {
        // Serialize quota checks for this account. The early check above is a
        // fast rejection; this locked check closes the concurrent-upload race.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.userId}))`);
        const [row] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${reports.sizeBytes}), 0)` })
          .from(reports)
          .where(eq(reports.userId, ctx.userId));
        const currentUsed = Number(row?.total ?? 0);
        if (currentUsed + decoded.buffer.length > STORAGE_QUOTA_BYTES) {
          throw new StorageQuotaError(currentUsed);
        }
        await tx.insert(reports).values({
          slug,
          userId: ctx.userId,
          title,
          description,
          issues,
          imageKey,
          imageContentType: "image/png",
          sizeBytes: decoded.buffer.length,
        });
      });
      return NextResponse.json({ url: `${SITE_URL}/s/${slug}`, slug });
    } catch (err) {
      await deleteImage(imageKey);
      if (err instanceof StorageQuotaError) return quotaResponse(err.usedBytes);
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "could not allocate an id" }, { status: 500 });
}
