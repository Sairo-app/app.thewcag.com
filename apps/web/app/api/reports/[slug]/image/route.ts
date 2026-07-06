import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { getImage } from "@/lib/r2";

export const runtime = "nodejs";

/** Streams a report's image from R2 under a stable app.thewcag.com URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db
    .select({ imageKey: reports.imageKey, contentType: reports.imageContentType })
    .from(reports)
    .where(eq(reports.slug, slug))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const obj = await getImage(row.imageKey);
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    headers: {
      "Content-Type": row.contentType || obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
