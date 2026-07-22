import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, users } from "@/lib/schema";
import { SITE_URL, buildSharedReportMetadata, sanitizeReportIssues } from "@/lib/reports";
import { reportImageAlt } from "@/lib/report-view";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ReportViewTracker } from "@/components/ReportViewTracker";
import { ArrowRightIcon, CalendarIcon, FlagIcon } from "@/components/icons";
import { hasActiveProSubscription } from "@/lib/billing/entitlements";
import { isReportAvailable } from "@/lib/billing/subscriptions";
import { ReportExplorer } from "./ReportExplorer";
import { a11yScanReportFixture } from "@/lib/a11y-scan-fixture";

export const dynamic = "force-dynamic";

// cache() dedupes the two calls per request (generateMetadata + the page).
const getScreenshot = cache(async (slug: string) => {
  const fixture = a11yScanReportFixture(slug);
  if (fixture) return fixture;
  const [row] = await db
    .select({
      title: reports.title,
      description: reports.description,
      issues: reports.issues,
      createdAt: reports.createdAt,
      availabilityStatus: reports.availabilityStatus,
      graceEndsAt: reports.graceEndsAt,
      userId: reports.userId,
      brandName: users.brandName,
      brandColor: users.brandColor,
      brandLogoKey: users.brandLogoKey,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.userId))
    .where(eq(reports.slug, slug))
    .limit(1);
  if (!row || !isReportAvailable(row.availabilityStatus, row.graceEndsAt)) return null;
  const whiteLabelEnabled = await hasActiveProSubscription(row.userId);
  return { ...row, whiteLabelEnabled };
});

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shot = await getScreenshot(slug);
  if (!shot) return { title: "Screenshot not found" };

  return buildSharedReportMetadata({
    slug,
    title: shot.title,
    description: shot.description,
    issueCount: shot.issues.length,
  });
}

export default async function ScreenshotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shot = await getScreenshot(slug);
  if (!shot) notFound();

  const issues = sanitizeReportIssues(shot.issues);
  const imageUrl = `/api/s/${slug}/image`;

  // White-label: if the report owner set a brand, the page leads with their
  // logo/name/accent instead of TheWCAG's site header.
  const brand =
    shot.whiteLabelEnabled && (shot.brandName || shot.brandLogoKey)
      ? {
          name: shot.brandName,
          color: /^#[0-9a-fA-F]{6}$/.test(shot.brandColor ?? "") ? shot.brandColor! : null,
          logoUrl: shot.brandLogoKey ? `/api/brand/${shot.userId}/logo` : null,
        }
      : null;

  return (
    <div className="report-page flex min-h-screen flex-col">
      <ReportViewTracker slug={slug} />
      {brand?.color && <div aria-hidden="true" style={{ background: brand.color }} className="h-1 w-full" />}
      <header className="report-header border-b border-border">
        <div className="report-header__inner mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          {brand ? (
            <div className="flex min-w-0 items-center gap-2.5">
              {brand.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt={brand.name ?? "Logo"} className="h-6 w-auto max-w-[170px] object-contain" />
              )}
              {brand.name && <span className="truncate text-sm font-semibold">{brand.name}</span>}
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2" aria-label="TheWCAG home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
              <span className="text-sm font-bold tracking-tight">TheWCAG</span>
            </Link>
          )}
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">
            {shot.issues.length ? "Accessibility report" : "Shared screenshot"}
          </span>
        </div>
      </header>

      <main id="main" className="report-main mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6">
        <section id="report-overview" className="report-overview" aria-labelledby="report-title">
          <div>
            <p className="report-eyebrow">Shared accessibility report</p>
            <h1 id="report-title">{shot.title}</h1>
            {shot.description && <p className="report-overview__description">{shot.description}</p>}
            <div className="report-overview__meta">
              <span>
                <FlagIcon size={16} />
                {issues.length} {issues.length === 1 ? "finding" : "findings"}
              </span>
              <span>
                <CalendarIcon size={16} />
                Published <time dateTime={new Date(shot.createdAt).toISOString()}>{formatDate(shot.createdAt)}</time>
              </span>
            </div>
          </div>
          <CopyLinkButton
            url={`${SITE_URL}/s/${slug}`}
            className="report-copy-link inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-card"
          />
        </section>

        <nav className="report-in-page-nav" aria-label="Report sections">
          <a href="#report-overview">Overview</a>
          <a href="#report-screenshot">Annotated screenshot</a>
          <a href="#report-findings">Findings <span>{issues.length}</span></a>
        </nav>

        <ReportExplorer title={shot.title} issues={issues} imageUrl={imageUrl} imageAlt={reportImageAlt(shot.title, issues)} />

        <footer className="report-footer">
          {brand ? (
            <p className="report-attribution">
              Prepared with{" "}
              <a href={SITE_URL} target="_blank" rel="noopener noreferrer">TheWCAG accessibility audit software</a>
            </p>
          ) : (
            <Link href="/download" className="report-cta">
              Audit with TheWCAG
              <ArrowRightIcon size={16} />
            </Link>
          )}
        </footer>
      </main>
    </div>
  );
}
