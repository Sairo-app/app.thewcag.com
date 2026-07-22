import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { hasActiveProSubscription } from "@/lib/billing/entitlements";
import { isReportAvailable } from "@/lib/billing/subscriptions";
import { a11yScanReportFixture } from "@/lib/a11y-scan-fixture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9]{10}$/.test(slug)) return NextResponse.json({ counted: false }, { status: 400 });
  if (a11yScanReportFixture(slug)) return NextResponse.json({ counted: false });
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|slurp|facebookexternalhit|embed|preview|whatsapp|telegram/i.test(ua)) {
    return NextResponse.json({ counted: false });
  }
  const cookieName = `tw_report_${slug}`;
  if (req.cookies.has(cookieName)) return NextResponse.json({ counted: false });

  const [report, session] = await Promise.all([
    db.select({ userId: reports.userId, availabilityStatus: reports.availabilityStatus, graceEndsAt: reports.graceEndsAt }).from(reports).where(eq(reports.slug, slug)).limit(1),
    auth(),
  ]);
  if (!report[0]) return NextResponse.json({ counted: false }, { status: 404 });
  if (!isReportAvailable(report[0].availabilityStatus, report[0].graceEndsAt)) {
    return NextResponse.json({ counted: false }, { status: 410 });
  }
  if (session?.user?.id === report[0].userId) return NextResponse.json({ counted: false });
  if (!(await hasActiveProSubscription(report[0].userId))) {
    return NextResponse.json({ counted: false, analytics: false });
  }

  await db
    .update(reports)
    .set({ viewCount: sql`${reports.viewCount} + 1` })
    .where(eq(reports.slug, slug));
  const response = NextResponse.json({ counted: true });
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60,
    path: "/",
  });
  return response;
}
