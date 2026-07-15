import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Color Blindness Simulator for Your Whole Screen",
  description:
    "See any app through protanopia, deuteranopia, tritanopia, and low-acuity vision - live, across your whole screen. TheWCAG's color-blindness lens works in any macOS or Windows app.",
  alternates: { canonical: "/color-blindness-simulator" },
  openGraph: {
    title: "Color Blindness Simulator for Your Whole Screen",
    description:
      "Live protanopia, deuteranopia, tritanopia and low-acuity simulation over any app on macOS and Windows.",
    url: `${SITE}/color-blindness-simulator`,
  },
};

const TYPES = [
  ["Deuteranopia", "Reduced sensitivity to green - the most common form (~6% of men)."],
  ["Protanopia", "Reduced sensitivity to red; reds look darker and can blend with black."],
  ["Tritanopia", "Rare blue–yellow deficiency; blues and greens become hard to tell apart."],
  ["Low acuity / blur", "Simulates reduced sharpness to test whether layout survives without fine detail."],
];

const FAQ = [
  {
    q: "How many people are color blind?",
    a: "About 1 in 12 men (8%) and 1 in 200 women have some form of color vision deficiency - roughly 300 million people worldwide.",
  },
  {
    q: "Does the simulator work in any app?",
    a: "Yes. TheWCAG's lens is a live overlay, so it filters whatever is beneath it - your design tool, a website, a native app, or a video.",
  },
  {
    q: "Which types can I simulate?",
    a: "Deuteranopia, protanopia, tritanopia, and a low-acuity blur, each adjustable in strength from anomalous trichromacy up to full dichromacy.",
  },
];

export default function ColorBlindnessSimulatorPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Color Blindness Simulator</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Roughly <strong>1 in 12 men</strong> sees color differently. TheWCAG's lens lets you view
          any app through the most common color-vision deficiencies - live, across your entire
          screen - so you can catch information that relies on color alone.
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
          <h2 className="text-xl font-bold tracking-tight">Simulated vision types</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {TYPES.map(([t, d]) => (
              <li key={t} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">Why it matters (WCAG 1.4.1)</h2>
          <p className="mt-3 text-sm text-muted">
            Success Criterion 1.4.1 “Use of Color” requires that color is never the only way to
            convey information - think error states, chart series, or required-field markers. Viewing
            your UI through a simulator is the fastest way to spot where color is doing work that a
            label, icon, or pattern should share. Pair it with the{" "}
            <Link href="/color-contrast-checker" className="underline hover:text-foreground">
              contrast checker
            </Link>{" "}
            for a complete color pass.
          </p>
        </section>

        <section className="mt-14">
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
