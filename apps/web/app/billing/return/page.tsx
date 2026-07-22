import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BillingReturnStatus } from "@/components/BillingReturnStatus";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirming subscription", robots: { index: false } };

export default async function BillingReturnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/billing/return");
  return <><Header /><main id="main" className="app-page mx-auto max-w-xl px-6 py-16 text-center"><h1 className="text-2xl font-bold">Thank you</h1><div className="mt-4 rounded-xl border border-border bg-card p-6"><BillingReturnStatus /></div></main><Footer /></>;
}
