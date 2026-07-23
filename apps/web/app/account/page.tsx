import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { desktopDevices } from "@/lib/schema";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { revokeDevice } from "./actions";
import { RevokeAllDevicesButton } from "./RevokeAllDevicesButton";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { formatBytes } from "@/lib/quota";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account and devices", robots: { index: false } };

function date(value: Date | null): string {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Never";
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/account");
  const [devices, entitlements] = await Promise.all([
    db
      .select()
      .from(desktopDevices)
      .where(and(eq(desktopDevices.userId, userId), isNotNull(desktopDevices.claimedAt)))
      .orderBy(desc(desktopDevices.claimedAt)),
    resolveEntitlements(userId),
  ]);
  const billingMessage = (await searchParams).billing;
  const now = Date.now();
  const active = devices.filter(
    (device) => device.claimedAt && !device.revokedAt && device.expiresAt && device.expiresAt.getTime() > now,
  );

  return (
    <>
      <Header />
      <main id="main" className="app-page mx-auto max-w-3xl px-6 py-10">
        <h1 className="type-title-2 font-bold ">Account and connected devices</h1>
        <p className="mt-2 type-body text-muted">Signed in as {session.user.email}. Device access expires after 90 days of inactivity and can be revoked at any time.</p>

        {billingMessage === "portal-error" ? <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 type-body text-red-900">The billing portal could not be opened. Please try again.</p> : null}
        {billingMessage === "rate-limited" ? <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 type-body text-amber-950">Too many billing portal requests were made. Please try again in an hour.</p> : null}

        <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-labelledby="billing-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="type-callout font-semibold uppercase r text-primary">{entitlements.plan === "pro" ? "Pro plan" : "Free plan"}</p>
              <h2 id="billing-title" className="mt-1 font-semibold">Subscription and hosted services</h2>
              <p className="mt-1 type-body text-muted">Status: {entitlements.subscription.status === "none" ? "No subscription" : entitlements.subscription.status.replace("_", " ")}</p>
            </div>
            {entitlements.actions.canManageBilling ? <a href="/api/billing/portal" className="rounded-lg border border-border px-3 py-2 type-body font-medium hover:bg-background">Manage billing</a> : <Link href="/pricing" className="rounded-lg bg-primary px-3 py-2 type-body font-semibold text-primary-foreground">View Pro</Link>}
          </div>
          {entitlements.subscription.renewsAt ? <p className="mt-3 type-body">Renews {date(new Date(entitlements.subscription.renewsAt))}</p> : null}
          {entitlements.subscription.endsAt ? <p className="mt-3 type-body">Scheduled to end {date(new Date(entitlements.subscription.endsAt))}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3"><strong className="type-body">Managed AI</strong><p className="mt-1 type-callout text-muted">{entitlements.features.managedAi.used} of {entitlements.features.managedAi.limit} drafts used</p></div>
            <div className="rounded-lg border border-border p-3"><strong className="type-body">Hosted reports</strong><p className="mt-1 type-callout text-muted">{entitlements.features.hostedReports.active} of {entitlements.features.hostedReports.limit} active</p></div>
            <div className="rounded-lg border border-border p-3"><strong className="type-body">Storage</strong><p className="mt-1 type-callout text-muted">{formatBytes(entitlements.storage.usedBytes)} of {formatBytes(entitlements.storage.quotaBytes)}</p></div>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-labelledby="devices-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="devices-title" className="font-semibold">Desktop devices</h2><p className="type-body text-muted">{active.length} currently active</p></div>
            {active.length ? <RevokeAllDevicesButton /> : null}
          </div>
          {devices.length ? (
            <ul className="mt-4 divide-y divide-border">
              {devices.map((device) => {
                const isActive = Boolean(device.claimedAt && !device.revokedAt && device.expiresAt && device.expiresAt.getTime() > now);
                return (
                  <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <strong className="type-body">{device.deviceName || "Desktop device"}</strong>
                      <p className="type-callout text-muted">Connected {date(device.claimedAt)} · Last used {date(device.lastSeenAt)} · {isActive ? `Expires ${date(device.expiresAt)}` : device.revokedAt ? `Revoked ${date(device.revokedAt)}` : "Expired"}</p>
                    </div>
                    {isActive ? <form action={revokeDevice.bind(null, device.id)}><button className="type-body font-medium text-red-700 hover:underline">Revoke</button></form> : <span className="type-callout text-muted">Inactive</span>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-4 type-body text-muted">No desktop devices have been connected.</p>}
        </section>

        <section className="mt-8 rounded-xl border border-red-300 bg-red-50 p-5" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title" className="font-semibold text-red-900">Delete account and hosted data</h2>
          <p className="mt-2 type-body text-red-900">This first cancels any known active Pro subscription, then permanently removes your account, sessions, device tokens, public reports, report images, AI usage metadata, and branding. If billing cancellation cannot be confirmed, nothing is deleted. Local audits on your computer are not deleted.</p>
          <DeleteAccountForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
