import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { getImage } from "@/lib/r2";
import { isReportAvailable } from "@/lib/billing/subscriptions";
import { A11Y_SCAN_PNG_BASE64, a11yScanReportFixture } from "@/lib/a11y-scan-fixture";

export const runtime = "nodejs";

/**
 * Stable, lifecycle-aware image URL for report pages and social previews.
 * R2 stays private; this route checks report availability before streaming.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (a11yScanReportFixture(slug)) {
    return new NextResponse(Buffer.from(A11Y_SCAN_PNG_BASE64, "base64"), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const [row] = await db
    .select({ imageKey: reports.imageKey, contentType: reports.imageContentType, availabilityStatus: reports.availabilityStatus, graceEndsAt: reports.graceEndsAt })
    .from(reports)
    .where(eq(reports.slug, slug))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (!isReportAvailable(row.availabilityStatus, row.graceEndsAt)) {
    return new NextResponse("This report is no longer available", { status: 410, headers: { "Cache-Control": "no-store" } });
  }

  const obj = await getImage(row.imageKey);
  if (!obj) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(obj.body), {
    headers: {
      "Content-Type": row.contentType || obj.contentType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
