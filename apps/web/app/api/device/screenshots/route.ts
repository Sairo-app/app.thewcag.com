import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports, type ReportIssue } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { decodePngBase64, generateSlug, isUniqueViolation, SITE_URL } from "@/lib/reports";
import { deleteImage, putImage } from "@/lib/r2";
import { STORAGE_QUOTA_BYTES, formatBytes, userStorageBytes } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const title = (typeof b.title === "string" ? b.title : "Accessibility screenshot").slice(0, 140);
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.slice(0, 500) : null;
  const issues: ReportIssue[] = Array.isArray(b.issues) ? (b.issues as ReportIssue[]).slice(0, 100) : [];

  // Per-user 1 GiB image cap: reject before writing anything to R2.
  const used = await userStorageBytes(ctx.userId);
  if (used + decoded.buffer.length > STORAGE_QUOTA_BYTES) {
    return NextResponse.json(
      {
        error: "storage_quota_exceeded",
        message: `Image storage limit reached (${formatBytes(used)} of ${formatBytes(STORAGE_QUOTA_BYTES)} used). Delete some shared screenshots to free space.`,
        usedBytes: used,
        quotaBytes: STORAGE_QUOTA_BYTES,
      },
      { status: 413 },
    );
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const imageKey = `screenshots/${slug}.png`;
    try {
      await putImage(imageKey, decoded.buffer, "image/png");
      await db.insert(reports).values({
        slug,
        userId: ctx.userId,
        title,
        description,
        issues,
        imageKey,
        imageContentType: "image/png",
        sizeBytes: decoded.buffer.length,
      });
      return NextResponse.json({ url: `${SITE_URL}/s/${slug}`, slug });
    } catch (err) {
      await deleteImage(imageKey);
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "could not allocate an id" }, { status: 500 });
}
