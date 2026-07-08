import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const FEATURES = [
  {
    title: "Contrast anywhere on screen",
    body: "Pick any two pixels and read the exact WCAG 2.2 ratio, AA/AAA verdict, and APCA - in any app, not just the browser.",
    href: "/color-contrast-checker",
    cta: "Contrast checker",
  },
  {
    title: "Color-blindness lens",
    body: "View your UI through protanopia, deuteranopia, tritanopia, and low-acuity vision, live over any window.",
    href: "/color-blindness-simulator",
    cta: "Color blindness simulator",
  },
  {
    title: "Annotate & share",
    body: "Capture a region, flag issues against WCAG success criteria, and publish an annotated report to a shareable link.",
    href: "/screenshot-tool",
    cta: "Screenshot tool guide",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-6">
        <section className="flex flex-col items-center pt-20 pb-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={72} height={72} className="mb-6 h-18 w-18" />
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight">
            Accessibility, anywhere on your screen
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            TheWCAG is a free desktop app for macOS and Windows that checks WCAG color contrast,
            simulates color blindness, and turns annotated screenshots into shareable accessibility
            reports.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/download"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Download for macOS & Windows
            </Link>
            <Link
              href="/screenshots"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-card"
            >
              My screenshots
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-8 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{f.body}</p>
              <Link href={f.href} className="mt-4 text-sm font-medium text-primary hover:underline">
                {f.cta} →
              </Link>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
