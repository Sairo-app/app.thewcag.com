import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "APCA vs WCAG 2 Contrast - What Changes and What to Use",
  description:
    "APCA explained in plain terms: how it differs from the WCAG 2 contrast ratio, what Lc values mean, thresholds by text size, and how to use both today.",
  path: "/apca-contrast",
  keywords: ["APCA contrast", "APCA vs WCAG", "Lc contrast value", "WCAG contrast ratio"],
});

const LC_TABLE: [string, string][] = [
  ["Lc 90", "Preferred for body text at small sizes (like 14px regular)."],
  ["Lc 75", "Minimum for body text; comfortable for most paragraph reading."],
  ["Lc 60", "Minimum for larger text (roughly 24px regular or 16px bold)."],
  ["Lc 45", "Large headlines and semi-bold UI labels."],
  ["Lc 30", "Absolute minimum for any readable text; placeholder-grade."],
  ["Lc 15", "Non-text elements only - dividers, subtle borders."],
];

const FAQ = [
  {
    q: "Is APCA part of WCAG 2.2?",
    a: "No. WCAG 2.x conformance is still measured with the 4.5:1 / 3:1 contrast ratios. APCA is the candidate model for WCAG 3, still in draft. Legal and contractual requirements today almost always mean WCAG 2.x ratios.",
  },
  {
    q: "Why do the two models disagree?",
    a: "The WCAG 2 ratio treats colors symmetrically and underweights how humans actually perceive lightness, especially on dark backgrounds. APCA models perceptual lightness contrast (including polarity - dark-on-light vs light-on-dark), so a pair that passes 4.5:1 can be genuinely hard to read and APCA will say so.",
  },
  {
    q: "Which should I use?",
    a: "Both. Pass WCAG 2 ratios for conformance, and use APCA as the better design signal - especially for dark mode and thin or small type. When the two disagree, the safest interpretation is: fix anything that fails either.",
  },
];

export default function ApcaContrastPage() {
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
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">APCA vs the WCAG 2 contrast ratio</h1>
        <p className="mt-3 max-w-2xl text-muted">
          APCA (Accessible Perceptual Contrast Algorithm) is the contrast model being developed for
          WCAG 3. Instead of a single ratio like 4.5:1, it produces an <strong>Lc value</strong>{" "}
          (lightness contrast, roughly -108 to +106) that tracks how readable a color pair actually
          is, including the difference between dark-on-light and light-on-dark.
        </p>

        <section className="mt-12" aria-labelledby="differences">
          <h2 id="differences" className="text-xl font-bold tracking-tight">
            What actually changes
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li className="rounded-xl border border-border bg-card p-4">
              <strong className="text-foreground">Polarity matters.</strong> White text on a dark
              surface and dark text on a white surface with the same WCAG ratio do not read equally
              well. APCA scores them differently; the WCAG 2 ratio cannot.
            </li>
            <li className="rounded-xl border border-border bg-card p-4">
              <strong className="text-foreground">Size and weight are part of the threshold.</strong>{" "}
              WCAG 2 has two buckets (normal / large). APCA expects thinner and smaller type to need
              more contrast, on a continuous scale.
            </li>
            <li className="rounded-xl border border-border bg-card p-4">
              <strong className="text-foreground">Mid-tone pairs get re-scored.</strong> Orange, teal,
              and grey mid-tones that scrape past 4.5:1 often fail APCA, leaving users to squint at them.
              The reverse also happens: some pairs failing 4.5:1 are perceptually fine.
            </li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="thresholds">
          <h2 id="thresholds" className="text-xl font-bold tracking-tight">
            Lc thresholds at a glance
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">Lc value</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Good for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {LC_TABLE.map(([lc, use]) => (
                  <tr key={lc}>
                    <td className="px-4 py-2.5 font-mono text-xs">{lc}</td>
                    <td className="px-4 py-2.5 text-muted">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Values are magnitudes. An Lc of -75 (light text on dark) is as strong as +75. Thresholds
            summarize the current APCA guidance and may shift before WCAG 3 ships.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-bold tracking-tight">
            Common questions
          </h2>
          <dl className="mt-5 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-base font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Read both numbers from any pixel</h2>
          <p className="mt-2 text-sm text-muted">
            TheWCAG&apos;s desktop picker reports the WCAG 2.2 ratio with the selected AA verdict{" "}
            <em>and</em> the APCA Lc value for any two pixels on screen in any app, not just the
            browser. Also try the{" "}
            <Link href="/color-contrast-checker" className="font-medium text-primary hover:underline">
              desktop contrast picker guide
            </Link>
            .
          </p>
          <Link
            href="/download"
            className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download free for macOS &amp; Windows
          </Link>
        </section>
        <ProductLinks heading="Move from contrast measurements to audit evidence" />
      </main>
      <Footer />
    </>
  );
}
