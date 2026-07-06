import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, type ReportIssue } from "@/lib/schema";
import { SITE_URL } from "@/lib/reports";
import { publicImageUrl } from "@/lib/r2";
import { Header } from "@/components/Header";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ArrowRightIcon, CalendarIcon, FlagIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

async function getScreenshot(slug: string) {
  const [row] = await db
    .select({
      title: reports.title,
      description: reports.description,
      issues: reports.issues,
      imageKey: reports.imageKey,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shot = await getScreenshot(slug);
  if (!shot) return { title: "Screenshot not found - TheWCAG" };

  // Prefer the R2 CDN URL directly for og:image (most crawler-friendly);
  // fall back to the stable app route when no public bucket is configured.
  const image = publicImageUrl(shot.imageKey) ?? `${SITE_URL}/api/s/${slug}/image`;
  const count = shot.issues.length;
  const description =
    shot.description ||
    `${count} accessibility ${count === 1 ? "issue" : "issues"} annotated in the TheWCAG desktop app.`;
  return {
    title: `${shot.title} - TheWCAG`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: shot.title, description, images: [{ url: image, width: 1400 }], type: "article" },
    twitter: { card: "summary_large_image", title: shot.title, description, images: [image] },
  };
}

const SEVERITY_COLOR: Record<string, string> = {
  blocker: "#DC2626",
  major: "#F59E0B",
  minor: "#64748B",
};

export default async function ScreenshotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shot = await getScreenshot(slug);
  if (!shot) notFound();

  await db
    .update(reports)
    .set({ viewCount: sql`${reports.viewCount} + 1` })
    .where(eq(reports.slug, slug))
    .catch(() => {});

  const issues = shot.issues as ReportIssue[];
  const summary = [
    { sev: "blocker", n: issues.filter((i) => i.severity === "blocker").length, color: SEVERITY_COLOR.blocker },
    { sev: "major", n: issues.filter((i) => i.severity === "major").length, color: SEVERITY_COLOR.major },
    { sev: "minor", n: issues.filter((i) => i.severity === "minor").length, color: SEVERITY_COLOR.minor },
  ].filter((s) => s.n > 0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* two columns on desktop: screenshot on the left, findings on the right */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/s/${slug}/image`}
              alt={shot.title}
              className="max-h-[calc(100vh-120px)] w-full rounded-xl border border-border object-contain shadow-sm"
            />
          </section>

          <aside className="flex max-h-[calc(100vh-120px)] flex-col">
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
                    {new Date(shot.createdAt).toLocaleDateString()}
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
                    style={{ backgroundColor: s.color }}
                  >
                    {s.n} {s.sev}
                  </span>
                ))}
              </div>
            )}

            {issues.length > 0 && (
              <ol className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {issues.map((issue) => (
                  <li key={issue.n} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: SEVERITY_COLOR[issue.severity] ?? SEVERITY_COLOR.major }}
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
                        <span>{issue.label}</span>
                      </p>
                      {issue.note && <p className="mt-0.5 text-sm text-muted">{issue.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <Link
              href="https://thewcag.com"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Audit with the TheWCAG app
              <ArrowRightIcon size={16} />
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}
