import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-2xl font-bold text-background">
        A
      </div>
      <h1 className="text-2xl font-bold tracking-tight">app.thewcag.com</h1>
      <p className="mt-3 text-sm text-muted">
        The account &amp; sharing backend for the TheWCAG desktop app. Sign in from the app to
        connect your account, then publish annotated accessibility reports to shareable links.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/reports"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-card"
        >
          My shared reports
        </Link>
        <a
          href="https://thewcag.com"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Get the app
        </a>
      </div>
    </main>
  );
}
