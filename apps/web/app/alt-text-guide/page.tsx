import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "How to Write Alt Text - Rules, Examples, and Edge Cases",
  description:
    "A practical alt-text guide for WCAG 1.1.1: when to describe, when to leave alt empty, and how to handle charts, icons, logos, and screenshots with before/after examples.",
  path: "/alt-text-guide",
  keywords: ["how to write alt text", "WCAG 1.1.1", "alt text examples", "accessible images"],
});

const RULES: { title: string; body: string }[] = [
  {
    title: "Describe the function, not the pixels",
    body: "Ask what the image is doing on the page. A magnifying-glass icon inside a search button is “Search”, not “magnifying glass”. If the image is a link, the alt text is the destination: “Invoice #1042 (PDF)”.",
  },
  {
    title: "Decorative images get empty alt",
    body: "alt=\"\" (empty, but present) tells screen readers to skip the image entirely. Use it for background flourishes, spacers, and any image whose meaning is fully carried by adjacent text. Omitting the attribute is a failure - readers fall back to the filename.",
  },
  {
    title: "Don't say “image of”",
    body: "Screen readers already announce “image”. “Image of a bar chart of Q3 revenue” reads as “image, image of a bar chart…”. Start with the content: “Bar chart: Q3 revenue up 14% to $2.1M”.",
  },
  {
    title: "Charts: headline the takeaway, table the data",
    body: "Alt text carries the chart's message in one sentence (“Line chart: sign-ups doubled after the March launch”). The underlying numbers belong in a real table or surrounding text, not crammed into alt.",
  },
  {
    title: "Screenshots: describe what matters for the point being made",
    body: "A screenshot in a bug report needs the failing part described (“Settings page with the Save button disabled and no error message”), not every menu item. If text in the screenshot is essential, repeat it in the page text.",
  },
  {
    title: "Logos: the name, once",
    body: "A logo's alt is the company name (“TheWCAG”). If it links home, “TheWCAG home”. If a wordmark sits next to the same name in text, the image is decorative - empty alt.",
  },
  {
    title: "Keep it under ~150 characters",
    body: "Alt text is heard linearly and can't be skimmed. If a faithful description needs more, put the long version in visible text or a linked description and keep alt as the summary.",
  },
];

const FAQ = [
  {
    q: "Is missing alt text really a WCAG failure?",
    a: "Yes - 1.1.1 Non-text Content is Level A, the baseline. It is also the single most common failure found in automated audits of the top million homepages.",
  },
  {
    q: "What about AI-generated images or avatars?",
    a: "Same rules. If the image carries meaning, describe the meaning; if it is decoration, empty alt. “AI-generated” is only worth mentioning when provenance is the point.",
  },
  {
    q: "Do background images need alt text?",
    a: "CSS background images can't have alt text, so anything meaningful must not be a background image. If it is purely decorative, CSS backgrounds are actually the cleanest choice.",
  },
];

export default function AltTextGuidePage() {
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
        <h1 className="text-3xl font-bold tracking-tight">How to write alt text</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Alt text is the most common accessibility failure on the web and one of the easiest to
          fix. The rules below cover WCAG 1.1.1 in practice: what to write, when to write nothing,
          and the edge cases, including charts, icons, logos, and screenshots, where teams get stuck.
        </p>

        <section className="mt-12" aria-labelledby="rules">
          <h2 id="rules" className="text-xl font-bold tracking-tight">
            The rules that cover 95% of cases
          </h2>
          <ol className="mt-5 space-y-6">
            {RULES.map((r, i) => (
              <li key={r.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="examples">
          <h2 id="examples" className="text-xl font-bold tracking-tight">
            Before and after
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">Weak</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Better</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">alt=&quot;chart.png&quot;</td>
                  <td className="px-4 py-2.5">alt=&quot;Bar chart: mobile sign-ups overtook desktop in June&quot;</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">alt=&quot;icon&quot;</td>
                  <td className="px-4 py-2.5">alt=&quot;Delete draft&quot; (the button&apos;s action)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">alt=&quot;photo of our team at the offsite smiling&quot;</td>
                  <td className="px-4 py-2.5">alt=&quot;The 12-person team at the 2025 offsite in Lisbon&quot;</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">(no alt attribute)</td>
                  <td className="px-4 py-2.5">alt=&quot;&quot; for decoration; never omit the attribute</td>
                </tr>
              </tbody>
            </table>
          </div>
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
          <h2 className="text-lg font-bold tracking-tight">Audit the rest of the page too</h2>
          <p className="mt-2 text-sm text-muted">
            Alt text is one criterion. TheWCAG&apos;s free desktop app checks the visual ones:
            contrast, target size, and color-blind safety anywhere on screen, and turns findings into
            a shareable report. See the{" "}
            <Link href="/wcag-checklist" className="font-medium text-primary hover:underline">
              full WCAG 2.2 checklist
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
        <ProductLinks heading="Connect content review to the full audit" />
      </main>
      <Footer />
    </>
  );
}
