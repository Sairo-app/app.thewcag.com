import { desc, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { desktopDevices, reports, users } from "@/lib/schema";
import { requireAdmin } from "@/lib/admin";
import { adminDeleteUser } from "@/app/admin/actions";
import { AdminConfirmButton } from "@/components/AdminConfirmButton";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

export default async function AdminUsers() {
  const admin = await requireAdmin(); // layout already gates; this is for self-id below

  const [rows, reportAgg, deviceAgg] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        verified: users.emailVerified,
        brandName: users.brandName,
      })
      .from(users)
      .orderBy(desc(users.emailVerified))
      .limit(500),
    db
      .select({
        userId: reports.userId,
        n: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${reports.sizeBytes}), 0)::bigint`,
      })
      .from(reports)
      .groupBy(reports.userId),
    db
      .select({ userId: desktopDevices.userId, n: sql<number>`count(*)::int` })
      .from(desktopDevices)
      .where(isNull(desktopDevices.revokedAt))
      .groupBy(desktopDevices.userId),
  ]);

  const byUserReports = new Map(reportAgg.map((r) => [r.userId, r]));
  const byUserDevices = new Map(deviceAgg.map((d) => [d.userId, d.n]));

  return (
    <section aria-label="All users">
      <p className="text-sm text-muted">
        {rows.length} user{rows.length === 1 ? "" : "s"}. Deleting a user removes their account,
        devices, reports, and stored images permanently.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Brand</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Reports</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Storage</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Devices</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">First sign-in</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => {
              const rep = byUserReports.get(u.id);
              const self = admin?.userId === u.id;
              return (
                <tr key={u.id}>
                  <td className="max-w-[240px] truncate px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted">{u.brandName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep?.n ?? 0}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatBytes(Number(rep?.bytes ?? 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{byUserDevices.get(u.id) ?? 0}</td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {u.verified
                      ? new Date(u.verified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {self ? (
                      <span className="text-xs text-muted">you</span>
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
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
