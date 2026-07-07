import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "WCAG Color Contrast Requirements Explained (2.1 & 2.2)",
  description:
    "A clear guide to WCAG color contrast: the 4.5:1 and 3:1 minimums, success criteria 1.4.3, 1.4.6 and 1.4.11, large-text rules, and how contrast ratio is calculated.",
  alternates: { canonical: "/wcag-contrast" },
  openGraph: {
    title: "WCAG Color Contrast Requirements Explained",
    description:
      "The 4.5:1 and 3:1 minimums, success criteria 1.4.3 / 1.4.11, large-text rules, and how the ratio is calculated.",
    url: `${SITE}/wcag-contrast`,
  },
};

const FAQ = [
  {
    q: "What contrast ratio does WCAG require?",
    a: "WCAG 2.1/2.2 AA requires 4.5:1 for normal text, 3:1 for large text, and 3:1 for user-interface components and meaningful graphics. AAA requires 7:1 for normal text and 4.5:1 for large text.",
  },
  {
    q: "What counts as large text?",
    a: "Text that is at least 24px (18pt) regular, or 18.66px (14pt) bold. Large text has a lower contrast requirement because bigger glyphs remain legible at lower contrast.",
  },
  {
    q: "How is contrast ratio calculated?",
    a: "It is (L1 + 0.05) / (L2 + 0.05), where L1 and L2 are the relative luminance of the lighter and darker colors. Ratios range from 1:1 (identical) to 21:1 (black on white).",
  },
];

export default function WcagContrastPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">
          WCAG color contrast requirements, explained
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Color contrast is one of the most common accessibility failures - and one of the easiest
          to fix. Here is exactly what WCAG 2.1 and 2.2 require, why, and how the numbers are
          derived.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">The minimums (Success Criterion 1.4.3, AA)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">What</th>
                  <th className="py-2 pr-4 font-medium">AA (1.4.3)</th>
                  <th className="py-2 font-medium">AAA (1.4.6)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Normal text", "4.5:1", "7:1"],
                  ["Large text (≥ 24px / 18.66px bold)", "3:1", "4.5:1"],
                  ["UI components & graphics (1.4.11)", "3:1", "-"],
                  ["Incidental / disabled / logos", "exempt", "exempt"],
                ].map(([w, aa, aaa]) => (
                  <tr key={w} className="border-b border-border">
                    <td className="py-2 pr-4">{w}</td>
                    <td className="py-2 pr-4 font-mono">{aa}</td>
                    <td className="py-2 font-mono">{aaa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Non-text contrast (1.4.11)</h2>
          <p className="mt-3 text-sm text-muted">
            Added in WCAG 2.1, this criterion extends the 3:1 minimum to interactive components
            (buttons, inputs, focus indicators) and to graphical objects needed to understand
            content (icons, chart lines). It is frequently missed because teams only check body text.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">How the ratio is calculated</h2>
          <p className="mt-3 text-sm text-muted">
            Contrast ratio is <span className="font-mono">(L1 + 0.05) / (L2 + 0.05)</span>, where L1
            and L2 are the relative luminance of the lighter and darker color. The result ranges from
            1:1 (no contrast) to 21:1 (pure black on pure white). Because luminance is perceptual,
            two colors with similar brightness can fail even when they look different in hue.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Check any pixel on your screen</h2>
          <p className="mt-2 text-sm text-muted">
            TheWCAG computes all of the above live as you pick colors from any app - with the
            worst-case pixel across gradients, AA/AAA verdicts, and APCA.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/download"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Download TheWCAG
            </Link>
            <Link
              href="/color-contrast-checker"
              className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-card"
            >
              About the contrast checker
            </Link>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">FAQ</h2>
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
