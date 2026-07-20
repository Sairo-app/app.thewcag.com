import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, users } from "@/lib/schema";
import { adminDeleteReport } from "@/app/admin/actions";
import { AdminConfirmButton } from "@/components/AdminConfirmButton";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

export default async function AdminReports() {
  const rows = await db
    .select({
      slug: reports.slug,
      title: reports.title,
      views: reports.viewCount,
      size: reports.sizeBytes,
      created: reports.createdAt,
      owner: users.email,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.userId))
    .orderBy(desc(reports.createdAt))
    .limit(500);

  return (
    <section aria-label="All reports">
      <p className="text-sm text-muted">
        {rows.length} published report{rows.length === 1 ? "" : "s"}. Deleting one revokes its
        public link immediately and removes the stored image.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/s/${r.slug}/image`}
              alt=""
              loading="lazy"
              className="h-14 w-20 shrink-0 rounded border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <Link href={`/s/${r.slug}`} className="block truncate text-sm font-medium hover:underline">
                {r.title}
              </Link>
              <p className="mt-0.5 truncate text-xs text-muted">
                {r.owner ?? "unknown"}, {r.views} view{r.views === 1 ? "" : "s"},{" "}
                {formatBytes(r.size)},{" "}
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
          <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
            No reports yet.
          </li>
        )}
      </ul>
    </section>
  );
}
