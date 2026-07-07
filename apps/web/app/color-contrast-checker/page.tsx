import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Color Contrast Checker for macOS & Windows",
  description:
    "Check WCAG color contrast anywhere on your screen - not just in the browser. TheWCAG samples any two pixels and shows the exact contrast ratio, AA/AAA pass or fail, and APCA score.",
  alternates: { canonical: "/color-contrast-checker" },
  openGraph: {
    title: "Color Contrast Checker for macOS & Windows",
    description:
      "Sample any two pixels on screen and get the exact WCAG contrast ratio, AA/AAA verdict, and APCA Lc.",
    url: `${SITE}/color-contrast-checker`,
  },
};

const FAQ = [
  {
    q: "What is a good color contrast ratio?",
    a: "WCAG 2.2 AA requires at least 4.5:1 for normal text and 3:1 for large text (18.66px bold or 24px regular) and UI components. AAA raises normal text to 7:1. TheWCAG shows the ratio and the pass/fail verdict for each level as you pick.",
  },
  {
    q: "Can I check contrast outside the browser?",
    a: "Yes. Unlike web-only tools, TheWCAG is a native desktop app, so you can sample colors from any application - design tools, native apps, PDFs, video - anywhere on screen.",
  },
  {
    q: "Does it support APCA?",
    a: "Yes. Alongside the WCAG 2.x ratio, TheWCAG reports the APCA Lc value (the contrast model proposed for WCAG 3) so you can compare both.",
  },
  {
    q: "Is it free?",
    a: "The contrast picker, color-blindness lens, and annotation tools are free. An account is only needed to publish shareable report links.",
  },
];

export default function ColorContrastCheckerPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Color Contrast Checker</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Check WCAG color contrast <strong>anywhere on your screen</strong> - not just inside a
          browser. Pick any foreground and background pixel and TheWCAG shows the exact contrast
          ratio, whether it passes WCAG 2.2 AA and AAA, and the APCA Lc score.
        </p>
        <div className="mt-6">
          <Link
            href="/download"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download the free app
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            <li><strong className="text-foreground">1. Freeze the screen.</strong> A magnified loupe appears so you can target the exact pixel.</li>
            <li><strong className="text-foreground">2. Click the text color, then the background.</strong> Drag across a gradient to find the worst-case pixel automatically.</li>
            <li><strong className="text-foreground">3. Read the verdict.</strong> Ratio, AA/AAA pass or fail for normal and large text, and APCA - instantly.</li>
            <li><strong className="text-foreground">4. Fix it.</strong> One click suggests the nearest passing color.</li>
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">WCAG contrast thresholds</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Content</th>
                  <th className="py-2 pr-4 font-medium">AA</th>
                  <th className="py-2 font-medium">AAA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Normal text (< 18.66px bold / 24px)", "4.5:1", "7:1"],
                  ["Large text (≥ 18.66px bold / 24px)", "3:1", "4.5:1"],
                  ["UI components & graphics", "3:1", "-"],
                ].map(([c, aa, aaa]) => (
                  <tr key={c} className="border-b border-border">
                    <td className="py-2 pr-4">{c}</td>
                    <td className="py-2 pr-4 font-mono">{aa}</td>
                    <td className="py-2 font-mono">{aaa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Full breakdown in the{" "}
            <Link href="/wcag-contrast" className="underline hover:text-foreground">
              WCAG contrast guide
            </Link>
            .
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </>
  );
}
