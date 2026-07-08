import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  AppleIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  FlagIcon,
  WindowsIcon,
} from "@/components/icons";

/** Half-filled circle — a small, honest glyph for "contrast". */
function ContrastIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
    </svg>
  );
}

const FEATURES: { icon: ReactNode; title: string; body: string; href: string; cta: string }[] = [
  {
    icon: <ContrastIcon />,
    title: "Contrast, anywhere",
    body: "Pick any two pixels in any app and read the exact WCAG 2.2 ratio, AA/AAA verdict, and APCA — not just in the browser.",
    href: "/color-contrast-checker",
    cta: "Contrast checker",
  },
  {
    icon: <EyeIcon size={20} />,
    title: "Color-blindness lens",
    body: "See your UI live through protanopia, deuteranopia, tritanopia, and low-acuity vision, over any window on screen.",
    href: "/color-blindness-simulator",
    cta: "Color-blindness simulator",
  },
  {
    icon: <FlagIcon size={20} />,
    title: "Annotate & share",
    body: "Capture a region, flag issues against WCAG success criteria, and publish an annotated report to one shareable link.",
    href: "/screenshot-tool",
    cta: "Screenshot tool",
  },
];

const STEPS = [
  { n: 1, title: "Capture or pick", body: "Grab a region of any app, or point at any pixel on screen." },
  { n: 2, title: "Check against WCAG", body: "Contrast ratios, color-blind views, and criteria — verified as you go." },
  { n: 3, title: "Share a link", body: "Publish an annotated report and hand anyone a clean, public link." },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-center pt-20 pb-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={64} height={64} className="mb-6 h-16 w-16" />
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1">
              <AppleIcon className="h-3 w-3" /> macOS
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <WindowsIcon className="h-3 w-3" /> Windows
            </span>
            <span aria-hidden="true">·</span>
            Free
          </span>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Accessibility checks, anywhere on your screen
          </h1>
          <p className="mt-5 max-w-xl text-balance text-muted">
            TheWCAG is a free desktop app that reads WCAG color contrast, simulates color blindness,
            and turns annotated screenshots into shareable reports — in every app, not just the
            browser.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Download free
              <ArrowRightIcon size={16} />
            </Link>
            <Link
              href="/screenshot-tool"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-card"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">No account needed to start.</p>
        </section>

        {/* Core tools */}
        <section aria-label="What TheWCAG does" className="grid gap-4 pb-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {f.icon}
              </span>
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{f.body}</p>
              <Link
                href={f.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {f.cta}
                <ArrowRightIcon size={14} />
              </Link>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section aria-label="How it works" className="py-16">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col items-center text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-sm font-semibold text-primary">
                  {s.n}
                </span>
                <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1.5 max-w-[15rem] text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="mb-20">
          <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <h2 className="max-w-md text-2xl font-bold tracking-tight">
              Start auditing in a couple of clicks
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              Free for macOS and Windows. It walks the walk — every button on this site passes the
              contrast it checks.
            </p>
            <Link
              href="/download"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Download free
              <ArrowRightIcon size={16} />
            </Link>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted">
              {["Works in any app", "No account to start", "WCAG 2.2 + APCA"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckIcon size={13} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
