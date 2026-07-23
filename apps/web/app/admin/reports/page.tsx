import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, users } from "@/lib/schema";
import { adminDeleteReport } from "@/app/admin/actions";
import { AdminConfirmButton } from "@/components/AdminConfirmButton";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

const PAGE_SIZE = 50;

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const requestedPage = Number((await searchParams).page || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [[totalRow], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(reports),
    db
      .select({
        slug: reports.slug,
        title: reports.title,
        views: reports.viewCount,
        size: reports.sizeBytes,
        created: reports.createdAt,
        availabilityStatus: reports.availabilityStatus,
        retentionDeleteAt: reports.retentionDeleteAt,
        owner: users.email,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.userId))
      .orderBy(desc(reports.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const total = totalRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pages === 1 ? "/admin/reports" : `/admin/reports?page=${pages}`);

  return (
    <section aria-label="All reports">
      <p className="type-body text-muted">
        {total} published report{total === 1 ? "" : "s"}. Deleting one revokes its
        public link immediately and removes the stored image.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.availabilityStatus !== "disabled" ? <img src={`/api/s/${r.slug}/image`} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded border border-border object-cover" /> : <div aria-hidden="true" className="flex h-14 w-20 shrink-0 items-center justify-center rounded border border-border bg-background type-callout text-muted">Off</div>}
            <div className="min-w-0 flex-1">
              {r.availabilityStatus !== "disabled" ? <Link href={`/s/${r.slug}`} className="block truncate type-body font-medium hover:underline">{r.title}</Link> : <span className="block truncate type-body font-medium">{r.title}</span>}
              <p className="mt-1 truncate type-callout text-muted">
                {r.owner ?? "unknown"}, {r.views} view{r.views === 1 ? "" : "s"},{" "}
                {formatBytes(r.size)}, {r.availabilityStatus}{r.retentionDeleteAt ? `, delete after ${new Date(r.retentionDeleteAt).toLocaleDateString("en-GB")}` : ""},{" "}
                {new Date(r.created).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <AdminConfirmButton
              label="Delete"
              confirmLabel="Delete report?"
              action={adminDeleteReport.bind(null, r.slug)}
            />
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-border bg-card p-8 text-center type-body text-muted">
            No reports yet.
          </li>
        )}
      </ul>
      {pages > 1 ? <nav aria-label="Report pages" className="mt-6 flex items-center justify-between type-body"><span>Page {Math.min(page, pages)} of {pages}</span><span className="flex gap-2">{page > 1 ? <Link href={`/admin/reports?page=${page - 1}`} className="rounded-lg border border-border px-3 py-2">Previous</Link> : null}{page < pages ? <Link href={`/admin/reports?page=${page + 1}`} className="rounded-lg border border-border px-3 py-2">Next</Link> : null}</span></nav> : null}
    </section>
  );
}
