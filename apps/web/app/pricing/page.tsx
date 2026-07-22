import type { Metadata } from "next";
import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PricingCheckoutButton } from "@/components/PricingCheckoutButton";
import {
  billingConfigured,
  hostedReportLimit,
  managedAiPeriodLimit,
  publicPrice,
} from "@/lib/billing/plans";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createPageMetadata({
  title: "Pricing",
  description: "TheWCAG's accessibility audit workspace is free. Pro adds managed AI and hosted report services.",
  path: "/pricing",
});

const FREE_FEATURES = [
  "Desktop audit workstation and browser extension",
  "Four-stage guided audits and finding-owned evidence",
  "Jira, Linear, and GitHub Issues connectors",
  "Accessible local reports, VPAT authoring, packages, and retesting",
  "Local accessibility program trends with table equivalents",
  "Bring-your-own-key AI authoring",
];

function usd(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const session = await auth();
  const checkoutCancelled = (await searchParams).checkout === "cancelled";
  const configured = billingConfigured();
  const monthly = publicPrice("month");
  const annual = publicPrice("year");
  const annualSaving = Math.max(0, monthly * 12 - annual);
  return (
    <>
      <Header />
      <main id="main" className="app-page pricing-page mx-auto max-w-5xl px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Simple pricing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">The audit workspace stays free</h1>
          <p className="mt-4 text-muted">Subscribe only when you want TheWCAG-hosted AI and report services. Your local audits and your own AI key do not require Pro.</p>
        </div>
        {checkoutCancelled ? <p role="status" className="mx-auto mt-6 max-w-2xl rounded-lg border border-border bg-card p-3 text-center text-sm">Checkout was cancelled. Nothing was charged and your current plan did not change.</p> : null}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="pricing-card rounded-2xl border border-border bg-card p-6" aria-labelledby="free-plan">
            <h2 id="free-plan" className="text-xl font-bold">Free</h2>
            <p className="mt-2 text-3xl font-bold">$0</p>
            <p className="mt-2 text-sm text-muted">Everything you need to run a complete local-first audit.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {FREE_FEATURES.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>{feature}</span></li>)}
            </ul>
          </section>

          <section className="pricing-card rounded-2xl border-2 border-primary bg-card p-6 shadow-sm" aria-labelledby="pro-plan">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 id="pro-plan" className="text-xl font-bold">Pro</h2><p className="mt-1 text-sm text-muted">Hosted services for client delivery</p></div>
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Optional</span>
            </div>
            <p className="mt-5 text-3xl font-bold">${usd(monthly)}<span className="text-base font-normal text-muted">/month</span></p>
            <p className="mt-1 text-sm text-muted">or ${usd(annual)}/year{annualSaving ? ` (save $${usd(annualSaving)})` : ""}</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>{managedAiPeriodLimit()} managed AI finding drafts per billing period</span></li>
              <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>Up to {hostedReportLimit()} hosted reports with share links</span></li>
              <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>View analytics and white-label hosted branding</span></li>
              <li className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>Invoices, cancellation, and payment updates in the secure billing portal</span></li>
            </ul>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Monthly</p><PricingCheckoutButton plan="pro-monthly" signedIn={Boolean(session?.user)} configured={configured} /></div>
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Annual</p><PricingCheckoutButton plan="pro-annual" signedIn={Boolean(session?.user)} configured={configured} /></div>
            </div>
          </section>
        </div>
        <p className="mx-auto mt-7 max-w-3xl text-center text-sm text-muted">Payments, taxes, invoices, and billing details are handled by Dodo Payments. Cancel from the billing portal; access continues according to the paid period and published retention policy.</p>
      </main>
      <Footer />
    </>
  );
}
