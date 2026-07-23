import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Color Contrast Checker for macOS & Windows",
  description:
    "Check WCAG color contrast anywhere on your screen. TheWCAG samples two pixels and shows the exact ratio, the selected WCAG AA verdict, APCA Lc, and passing color candidates.",
  path: "/color-contrast-checker",
  keywords: ["color contrast checker", "WCAG contrast checker", "screen color picker", "APCA contrast checker"],
});

const FAQ = [
  {
    q: "What is a good color contrast ratio?",
    a: "WCAG 2.2 AA requires at least 4.5:1 for normal text and 3:1 for large text and UI components. Choose the content mode in TheWCAG to see its applicable AA result; the table below also documents the enhanced AAA text thresholds.",
  },
  {
    q: "Can I check contrast outside the browser?",
    a: "Yes. Unlike web-only tools, TheWCAG is a native desktop app, so you can sample colors from any application - design tools, native apps, PDFs, video - anywhere on screen.",
  },
  {
    q: "Does it support APCA?",
    a: "Yes. Alongside the WCAG 2.x ratio, TheWCAG reports an APCA Lc value as a separate experimental comparison. The WCAG 2.2 result remains the audit decision shown by the tool.",
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
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-12">
        <h1 className="type-title-1 font-bold ">Color Contrast Checker</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Check WCAG color contrast <strong>anywhere on your screen</strong> - not just inside a
          browser. Pick any foreground and background pixel and TheWCAG shows the exact contrast
          ratio, whether it passes the selected WCAG 2.2 AA requirement, and the APCA Lc score.
        </p>
        <div className="mt-6">
          <Link
            href="/download"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-3 type-body font-semibold text-primary-foreground hover:opacity-90"
          >
            Download the free app
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="type-title-2 font-bold ">How it works</h2>
          <ol className="mt-4 space-y-3 type-body text-muted">
            <li><strong className="text-foreground">1. Freeze the screen.</strong> A magnified loupe appears so you can target the exact pixel.</li>
            <li><strong className="text-foreground">2. Click the text color, then the background.</strong> For gradients and images, sample each material color combination separately.</li>
            <li><strong className="text-foreground">3. Read the verdict.</strong> See the ratio, the selected normal-text, large-text, or UI-component AA result, and APCA Lc.</li>
            <li><strong className="text-foreground">4. Explore a fix.</strong> Review candidate colors that reach the selected WCAG threshold, then verify the final design in context.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="type-title-2 font-bold ">WCAG contrast thresholds</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left type-body">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Content</th>
                  <th scope="col" className="py-2 pr-4 font-medium">AA</th>
                  <th scope="col" className="py-2 font-medium">AAA</th>
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
          <p className="mt-3 type-body text-muted">
            Full breakdown in the{" "}
            <Link href="/wcag-contrast" className="underline hover:text-foreground">
              WCAG contrast guide
            </Link>
            .
          </p>
        </section>

        <section className="mt-12">
          <h2 className="type-title-2 font-bold ">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="type-body font-semibold">{f.q}</dt>
                <dd className="mt-1 type-body text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <ProductLinks heading="Turn contrast checks into traceable findings" />
      </main>
      <Footer />
    </>
  );
}
