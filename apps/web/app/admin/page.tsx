import Link from "next/link";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingSubscriptions, billingWebhookEvents, desktopDevices, reports, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function formatDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
}

export default async function AdminOverview() {
  const [[userAgg], [reportAgg], [deviceAgg], [proAgg], [webhookFailureAgg], recentUsers, recentReports] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        n: sql<number>`count(*)::int`,
        views: sql<number>`coalesce(sum(${reports.viewCount}), 0)::int`,
        bytes: sql<number>`coalesce(sum(${reports.sizeBytes}), 0)::bigint`,
      })
      .from(reports),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(desktopDevices)
      .where(and(isNull(desktopDevices.revokedAt), gt(desktopDevices.expiresAt, new Date()))),
    db.select({ n: sql<number>`count(distinct ${billingSubscriptions.userId})::int` }).from(billingSubscriptions).where(and(eq(billingSubscriptions.status, "active"), gt(billingSubscriptions.currentPeriodEnd, new Date()))),
    db.select({ n: sql<number>`count(*)::int` }).from(billingWebhookEvents).where(eq(billingWebhookEvents.status, "failed")),
    db
      .select({ email: users.email, verified: users.emailVerified, brand: users.brandName })
      .from(users)
      .orderBy(desc(users.emailVerified))
      .limit(8),
    db
      .select({ slug: reports.slug, title: reports.title, views: reports.viewCount, created: reports.createdAt })
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(8),
  ]);

  const KPIS = [
    { label: "Users", value: String(userAgg.n), href: "/admin/users" },
    { label: "Reports", value: String(reportAgg.n), href: "/admin/reports" },
    { label: "Total views", value: String(reportAgg.views), href: "/admin/reports" },
    { label: "Storage used", value: formatBytes(Number(reportAgg.bytes)), href: "/admin/reports" },
    { label: "Active devices", value: String(deviceAgg.n), href: "/admin/users" },
    { label: "Active Pro", value: String(proAgg.n), href: "/admin/users" },
    { label: "Failed webhooks", value: String(webhookFailureAgg.n), href: "/admin" },
  ];

  return (
    <div className="space-y-8">
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {KPIS.map((k) => (
          <Link key={k.label} href={k.href} className="card block p-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{k.value}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Recent sign-ins" className="card p-5">
          <h2 className="text-sm font-semibold">Recent sign-ins</h2>
          <ul className="mt-3 divide-y divide-border">
            {recentUsers.map((u) => (
              <li key={u.email} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{u.email}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {u.brand && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">brand</span>
                  )}
                  {formatDate(u.verified)}
                </span>
              </li>
            ))}
            {recentUsers.length === 0 && <li className="py-2 text-sm text-muted">No users yet.</li>}
          </ul>
        </section>

        <section aria-label="Latest reports" className="card p-5">
          <h2 className="text-sm font-semibold">Latest reports</h2>
          <ul className="mt-3 divide-y divide-border">
            {recentReports.map((r) => (
              <li key={r.slug} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/s/${r.slug}`} className="min-w-0 truncate hover:underline">
                  {r.title}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {r.views} views, {formatDate(r.created)}
                </span>
              </li>
            ))}
            {recentReports.length === 0 && <li className="py-2 text-sm text-muted">No reports yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
