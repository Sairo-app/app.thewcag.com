import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { SITE_URL } from "@/lib/reports";
import { CopyLinkButton } from "./CopyLinkButton";
import { DeleteReportButton } from "./DeleteReportButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My shared reports — TheWCAG", robots: { index: false } };

export default async function MyReportsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/reports");

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
    .orderBy(desc(reports.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">My shared reports</h1>
      <p className="mt-1 text-sm text-muted">
        Reports you&apos;ve published from the desktop app. Anyone with a link can view a report;
        delete one to revoke its link immediately.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border bg-card p-8 text-center text-sm text-muted">
          No shared reports yet. In the desktop app&apos;s annotation editor, tag your issues and
          press <strong>Share</strong> to publish one here.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => {
            const url = `${SITE_URL}/reports/${r.slug}`;
            return (
              <li key={r.slug} className="flex items-center gap-4 rounded-xl border bg-card p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/reports/${r.slug}/image`}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/reports/${r.slug}`} className="block truncate text-sm font-medium hover:underline">
                    {r.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.issues.length} {r.issues.length === 1 ? "issue" : "issues"} · {r.viewCount}{" "}
                    {r.viewCount === 1 ? "view" : "views"} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <CopyLinkButton url={url} className="text-xs text-muted hover:text-foreground" />
                  <DeleteReportButton slug={r.slug} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
