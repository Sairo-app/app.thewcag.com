import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BrandForm } from "@/components/BrandForm";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { brandLogoPath } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "White-label branding", robots: { index: false } };

export default async function BrandPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/brand");

  const [[row], entitlements] = await Promise.all([
    db.select({
      name: users.brandName,
      color: users.brandColor,
      key: users.brandLogoKey,
      assetToken: users.brandAssetToken,
    }).from(users).where(eq(users.id, userId)).limit(1),
    resolveEntitlements(userId),
  ]);

  const logoUrl = row?.key ? brandLogoPath(row.assetToken) : null;

  return (
    <>
      <Header />
      <main id="main" className="app-page mx-auto max-w-2xl px-6 py-10">
        <h1 className="type-title-2 font-bold ">White-label branding</h1>
        <p className="mt-2 type-body text-muted">
          Add your organization&apos;s logo, name, and accent color. Every report you share then
          leads with your brand instead of ours, so a link you hand a client looks like your work.{" "}
          <Link href="/screenshots" className="font-medium text-primary hover:underline">
            View your shared reports
          </Link>
          .
        </p>

        {entitlements.features.whiteLabelReports ? (
          <BrandForm initial={{ name: row?.name ?? "", color: row?.color ?? "", logoUrl }} />
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Available with Pro hosted reports</h2>
            <p className="mt-2 type-body text-muted">Local reports and exports remain free. Pro applies your organization&apos;s identity to hosted client links.</p>
            <Link href="/pricing" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 type-body font-semibold text-primary-foreground">View Pro pricing</Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
