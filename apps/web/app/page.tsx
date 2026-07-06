import Link from "next/link";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={72} height={72} className="mb-5 h-18 w-18" />
        <h1 className="text-2xl font-bold tracking-tight">app.thewcag.com</h1>
        <p className="mt-3 text-sm text-muted">
          The account and sharing service for the TheWCAG desktop app. Sign in from the app to
          connect your account, then publish annotated accessibility screenshots to shareable links.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/screenshots"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-card"
          >
            My screenshots
          </Link>
          <a
            href="/api/desktop/download"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download for macOS
          </a>
        </div>
      </main>
    </>
  );
}
