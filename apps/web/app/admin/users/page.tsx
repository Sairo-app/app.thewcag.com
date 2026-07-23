import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAdmin } from "@/lib/admin";
import { loadAdminUserDecorations } from "@/lib/admin-users";
import { adminDeleteUser } from "@/app/admin/actions";
import { AdminConfirmButton } from "@/components/AdminConfirmButton";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

const PAGE_SIZE = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const requestedPage = Number((await searchParams).page || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [[totalRow], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        id: users.id,
        email: users.email,
        verified: users.emailVerified,
        brandName: users.brandName,
      })
      .from(users)
      .orderBy(desc(users.emailVerified))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const total = totalRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(pages === 1 ? "/admin/users" : `/admin/users?page=${pages}`);

  const { reportAgg, deviceAgg, subscriptionRows } = await loadAdminUserDecorations(
    rows.map((row) => row.id),
  );

  const byUserReports = new Map(reportAgg.map((r) => [r.userId, r]));
  const byUserDevices = new Map(deviceAgg.map((d) => [d.userId, d.n]));
  const byUserSubscription = new Map<string, string>();
  for (const subscription of subscriptionRows) {
    if (!byUserSubscription.has(subscription.userId)) byUserSubscription.set(subscription.userId, subscription.status);
  }

  return (
    <section aria-label="All users">
      <p className="type-body text-muted">
        {total} user{total === 1 ? "" : "s"}. Deleting a user removes their account,
        devices, reports, and stored images permanently.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] type-body">
          <thead>
            <tr className="border-b border-border bg-card text-left type-callout uppercase text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              <th scope="col" className="px-4 py-3 font-medium">Brand</th>
              <th scope="col" className="px-4 py-3 font-medium">Plan</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Reports</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Storage</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Devices</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">First sign-in</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => {
              const rep = byUserReports.get(u.id);
              const self = admin.userId === u.id;
              return (
                <tr key={u.id}>
                  <td className="max-w-[240px] truncate px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 text-muted">{u.brandName ?? "Not set"}</td>
                  <td className="px-4 py-3 text-muted">{byUserSubscription.get(u.id) ?? "free"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rep?.n ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBytes(Number(rep?.bytes ?? 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{byUserDevices.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right text-muted">
                    {u.verified
                      ? new Date(u.verified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "Not set"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {self ? (
                      <span className="type-callout text-muted">you</span>
                    ) : (
                      <AdminConfirmButton
                        label="Delete"
                        confirmLabel="Delete user?"
                        action={adminDeleteUser.bind(null, u.id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? <nav aria-label="User pages" className="mt-6 flex items-center justify-between type-body"><span>Page {Math.min(page, pages)} of {pages}</span><span className="flex gap-2">{page > 1 ? <Link href={`/admin/users?page=${page - 1}`} className="rounded-lg border border-border px-3 py-2">Previous</Link> : null}{page < pages ? <Link href={`/admin/users?page=${page + 1}`} className="rounded-lg border border-border px-3 py-2">Next</Link> : null}</span></nav> : null}
    </section>
  );
}
