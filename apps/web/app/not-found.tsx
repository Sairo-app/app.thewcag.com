import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return <><Header /><main id="main" className="auth-page mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center"><h1 className="type-title-2 font-bold">Page not found</h1><p className="mt-3 type-body text-muted">The address may be outdated or the shared report may have been deleted.</p><Link href="/" className="mt-6 rounded-lg bg-primary px-4 py-2 type-body font-semibold text-primary-foreground">Return home</Link></main><Footer /></>;
}
