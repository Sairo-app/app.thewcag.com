import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reports", label: "Reports" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 404 (not 403) so the panel's existence isn't advertised to non-admins.
  const admin = await requireAdmin();
  if (!admin) notFound();

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <nav aria-label="Admin sections" className="flex gap-1 rounded-lg border border-border p-1">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-card hover:text-foreground"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8">{children}</div>
      </main>
    </>
  );
}
