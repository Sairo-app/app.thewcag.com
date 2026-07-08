import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { SITE_URL } from "@/lib/reports";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteButton } from "@/components/DeleteButton";
import { CalendarIcon, EyeIcon, FlagIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My screenshots", robots: { index: false } };

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function MyScreenshotsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/screenshots");

  const rows = await db
    .select({
      slug: reports.slug,
      title: reports.title,
      issues: reports.issues,
      viewCount: reports.viewCount,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))
    .limit(200);

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            My screenshots{rows.length > 0 && <span className="ml-2 font-normal text-muted">({rows.length})</span>}
          </h1>
          <Link
            href="/brand"
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-card"
          >
            White-label branding
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Annotated screenshots you published from the desktop app. Anyone with a link can view one;
          delete it to revoke the link immediately.
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
            No shared screenshots yet. In the desktop app, capture and annotate an issue, then press{" "}
            <strong>Share</strong> to publish one here.
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
                      <span className="inline-flex items-center gap-1">
                        <EyeIcon size={12} />
                        {r.viewCount} {r.viewCount === 1 ? "view" : "views"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon size={12} />
                        <time dateTime={new Date(r.createdAt).toISOString()}>{formatDate(r.createdAt)}</time>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <CopyLinkButton url={url} />
                    <DeleteButton slug={r.slug} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
