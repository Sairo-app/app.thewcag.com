import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { SITE_URL } from "@/lib/reports";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteButton } from "@/components/DeleteButton";
import { CalendarIcon, EyeIcon, FlagIcon } from "@/components/icons";
import { resolveEntitlements } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My screenshots", robots: { index: false } };

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const PAGE_SIZE = 50;

export default async function MyScreenshotsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/screenshots");

  const requestedPage = Number((await searchParams).page || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [[totalRow], rows, entitlements] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.userId, userId)),
    db
      .select({
        slug: reports.slug,
        title: reports.title,
        issues: reports.issues,
        viewCount: reports.viewCount,
        availabilityStatus: reports.availabilityStatus,
        graceEndsAt: reports.graceEndsAt,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    resolveEntitlements(userId),
  ]);
  const total = totalRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pages === 1 ? "/screenshots" : `/screenshots?page=${pages}`);

  return (
    <>
      <Header />
      <main id="main" className="app-page mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            My screenshots{total > 0 && <span className="ml-2 font-normal text-muted">({total})</span>}
          </h1>
          <Link
            href={entitlements.features.whiteLabelReports ? "/brand" : "/pricing"}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-card"
          >
            {entitlements.features.whiteLabelReports ? "White-label branding" : "Unlock hosted reports"}
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Annotated screenshots you published from the desktop app. Anyone with an active link can view one;
          delete it to revoke the link immediately. {!entitlements.features.hostedReports.enabled ? "Publishing new links requires Pro." : ""}
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
            <strong className="block text-base text-foreground">No published reports yet</strong>
            <p className="mx-auto mt-2 max-w-md">
              In the desktop app, collect and review the evidence, then open <strong>Deliver</strong> to publish a report you choose.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/getting-started" className="rounded-lg border border-border px-3 py-2 font-medium text-foreground hover:bg-background">Follow the first audit guide</Link>
              <Link href="/download" className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">Download the desktop app</Link>
            </div>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {rows.map((r) => {
              const url = `${SITE_URL}/s/${r.slug}`;
              return (
                <li key={r.slug} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/s/${r.slug}/image`}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/s/${r.slug}`} className="block truncate text-sm font-medium hover:underline">
                      {r.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <FlagIcon size={12} />
                        {r.issues.length} {r.issues.length === 1 ? "issue" : "issues"}
                      </span>
                      {entitlements.features.reportAnalytics ? <span className="inline-flex items-center gap-1"><EyeIcon size={12} />{r.viewCount} {r.viewCount === 1 ? "view" : "views"}</span> : null}
                      <span className="rounded border border-border px-1.5 py-0.5">{r.availabilityStatus === "active" ? "Live" : r.availabilityStatus === "grace" ? "Grace period" : "Unavailable"}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon size={12} />
                        <time dateTime={new Date(r.createdAt).toISOString()}>{formatDate(r.createdAt)}</time>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.availabilityStatus !== "disabled" ? <CopyLinkButton url={url} /> : null}
                    <DeleteButton slug={r.slug} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 ? <nav aria-label="Report pages" className="mt-6 flex items-center justify-between text-sm"><span>Page {Math.min(page, pages)} of {pages}</span><span className="flex gap-2">{page > 1 ? <Link href={`/screenshots?page=${page - 1}`} className="rounded-lg border border-border px-3 py-2">Previous</Link> : null}{page < pages ? <Link href={`/screenshots?page=${page + 1}`} className="rounded-lg border border-border px-3 py-2">Next</Link> : null}</span></nav> : null}
      </main>
      <Footer />
    </>
  );
}
