import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { getImage, publicImageUrl } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Stable image URL under app.thewcag.com (used for <img> and og:image).
 * In production, redirects to the R2 CDN so Cloudflare serves the bytes and
 * the app never proxies them. In dev (no public URL) it streams from R2/MinIO.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db
    .select({ imageKey: reports.imageKey, contentType: reports.imageContentType })
    .from(reports)
    .where(eq(reports.slug, slug))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const cdn = publicImageUrl(row.imageKey);
  if (cdn) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: cdn, "Cache-Control": "public, max-age=3600" },
    });
  }

  const obj = await getImage(row.imageKey);
  if (!obj) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(obj.body), {
    headers: {
      "Content-Type": row.contentType || obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
