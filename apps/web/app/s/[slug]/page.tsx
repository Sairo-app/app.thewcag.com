import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, users, type ReportIssue } from "@/lib/schema";
import { SITE_URL } from "@/lib/reports";
import { publicImageUrl } from "@/lib/r2";
import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ArrowRightIcon, CalendarIcon, FlagIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

// cache() dedupes the two calls per request (generateMetadata + the page).
const getScreenshot = cache(async (slug: string) => {
  const [row] = await db
    .select({
      title: reports.title,
      description: reports.description,
      issues: reports.issues,
      imageKey: reports.imageKey,
      createdAt: reports.createdAt,
      userId: reports.userId,
      brandName: users.brandName,
      brandColor: users.brandColor,
      brandLogoKey: users.brandLogoKey,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.userId))
    .where(eq(reports.slug, slug))
    .limit(1);
  return row ?? null;
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

  // Prefer the R2 CDN URL directly for og:image (most crawler-friendly);
  // fall back to the stable app route when no public bucket is configured.
  const image = publicImageUrl(shot.imageKey) ?? `${SITE_URL}/api/s/${slug}/image`;
  const count = shot.issues.length;
  const description =
    shot.description ||
    `${count} accessibility ${count === 1 ? "issue" : "issues"} annotated in the TheWCAG desktop app.`;
  return {
    title: shot.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: shot.title, description, images: [{ url: image, width: 1400 }], type: "article" },
    twitter: { card: "summary_large_image", title: shot.title, description, images: [image] },
  };
}

// Severity chip colors chosen so white text clears WCAG AA (>= 4.5:1) on each.
const SEVERITY_COLOR: Record<string, string> = {
  blocker: "#B91C1C", // red-700
  major: "#B45309", // amber-700
  minor: "#475569", // slate-600
};

export default async function ScreenshotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shot = await getScreenshot(slug);
  if (!shot) notFound();

  // Don't inflate the view count with OG crawlers (Slack/Teams/etc. fetch the
  // page to unfurl the link) or the owner's own visits.
  const ua = (await headers()).get("user-agent") ?? "";
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|embed|preview|whatsapp|telegram/i.test(ua);
  const session = await auth();
  const isOwner = Boolean(session?.user?.id && session.user.id === shot.userId);
  if (!isBot && !isOwner) {
    await db
      .update(reports)
      .set({ viewCount: sql`${reports.viewCount} + 1` })
      .where(eq(reports.slug, slug))
      .catch(() => {});
  }

  const issues = shot.issues as ReportIssue[];
  const summary = [
    { sev: "blocker", n: issues.filter((i) => i.severity === "blocker").length },
    { sev: "major", n: issues.filter((i) => i.severity === "major").length },
    { sev: "minor", n: issues.filter((i) => i.severity === "minor").length },
  ].filter((s) => s.n > 0);

  // White-label: if the report owner set a brand, the page leads with their
  // logo/name/accent instead of TheWCAG's site header.
  const brand =
    shot.brandName || shot.brandLogoKey
      ? {
          name: shot.brandName,
          color: /^#[0-9a-fA-F]{6}$/.test(shot.brandColor ?? "") ? shot.brandColor! : null,
          logoUrl: shot.brandLogoKey
            ? publicImageUrl(shot.brandLogoKey) ?? `/api/brand/${shot.userId}/logo`
            : null,
        }
      : null;

  return (
    <>
      {brand ? (
        <>
          {brand.color && <div aria-hidden="true" style={{ background: brand.color }} className="h-1 w-full" />}
          <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                {brand.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt={brand.name ?? "Logo"} className="h-7 w-auto max-w-[180px] object-contain" />
                )}
                {brand.name && <span className="truncate text-sm font-semibold">{brand.name}</span>}
              </div>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                Accessibility report
              </span>
            </div>
          </header>
        </>
      ) : (
        <Header />
      )}
      <main id="main" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        {/* the screenshot is the star; findings sit in a compact side panel */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(280px,1fr)]">
          <section className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/s/${slug}/image`}
              alt={`Annotated screenshot: ${shot.title}`}
              className="max-h-[calc(100vh-84px)] w-full rounded-xl border border-border object-contain shadow-sm"
            />
          </section>

          <aside className="flex max-h-[calc(100vh-84px)] flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight">{shot.title}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <FlagIcon size={13} />
                    {issues.length} {issues.length === 1 ? "issue" : "issues"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon size={13} />
                    <time dateTime={new Date(shot.createdAt).toISOString()}>{formatDate(shot.createdAt)}</time>
                  </span>
                </div>
              </div>
              <CopyLinkButton
                url={`${SITE_URL}/s/${slug}`}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-card"
              />
            </div>

            {shot.description && <p className="mt-2 text-sm">{shot.description}</p>}

            {summary.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {summary.map((s) => (
                  <span
                    key={s.sev}
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: SEVERITY_COLOR[s.sev] }}
                  >
                    {s.n} {s.sev}
                  </span>
                ))}
              </div>
            )}

            {issues.length > 0 && (
              <ol
                className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
                tabIndex={0}
                aria-label="Findings"
              >
                {issues.map((issue) => (
                  <li key={issue.n} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: SEVERITY_COLOR[issue.severity] ?? SEVERITY_COLOR.major }}
                      title={`Severity: ${issue.severity}`}
                    >
                      {issue.n}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {issue.sc && (
                          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted">
                            WCAG {issue.sc}
                          </span>
                        )}
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          {issue.severity}
                        </span>
                        <span>{issue.label}</span>
                      </p>
                      {issue.note && <p className="mt-0.5 text-sm text-muted">{issue.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {brand ? (
              <p className="mt-4 text-center text-[11px] text-muted">
                Prepared with{" "}
                <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-foreground">
                  TheWCAG
                </a>
              </p>
            ) : (
              <Link
                href="/download"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Audit with TheWCAG
                <ArrowRightIcon size={16} />
              </Link>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
