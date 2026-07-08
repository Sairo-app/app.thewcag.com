import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { publicImageUrl } from "@/lib/r2";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BrandForm } from "@/components/BrandForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "White-label branding", robots: { index: false } };

export default async function BrandPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/brand");

  const [row] = await db
    .select({ name: users.brandName, color: users.brandColor, key: users.brandLogoKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const logoUrl = row?.key ? publicImageUrl(row.key) ?? `/api/brand/${userId}/logo` : null;

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">White-label branding</h1>
        <p className="mt-2 text-sm text-muted">
          Add your organization&apos;s logo, name, and accent color. Every report you share then
          leads with your brand instead of ours — so a link you hand a client looks like your work.{" "}
          <Link href="/screenshots" className="font-medium text-primary hover:underline">
            View your shared reports
          </Link>
          .
        </p>

        <BrandForm initial={{ name: row?.name ?? "", color: row?.color ?? "", logoUrl }} />
      </main>
      <Footer />
    </>
  );
}
