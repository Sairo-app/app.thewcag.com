import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "WCAG 2.2 AA Checklist - Practical Tests for Key Criteria",
  description:
    "A practical guide to frequently tested WCAG 2.2 Level A and AA criteria, plus the complete in-app checklist with prompts, notes, traceability, and exports.",
  path: "/wcag-checklist",
  keywords: ["WCAG 2.2 checklist", "WCAG AA checklist", "accessibility audit checklist", "WCAG success criteria"],
});

const GROUPS: { heading: string; intro: string; items: { sc: string; name: string; test: string }[] }[] = [
  {
    heading: "Perceivable",
    intro: "Users must be able to perceive the content by seeing it, hearing it, or reading it through assistive tech.",
    items: [
      { sc: "1.1.1", name: "Non-text content", test: "Every informative image has alt text; decorative images have empty alt." },
      { sc: "1.3.1", name: "Info and relationships", test: "Headings, lists, and tables use real markup, not styled text." },
      { sc: "1.4.3", name: "Contrast (minimum)", test: "Normal text is at least 4.5:1 against its background; large text 3:1." },
      { sc: "1.4.4", name: "Resize text", test: "Zoom the page to 200%; everything should remain readable with nothing clipped." },
      { sc: "1.4.10", name: "Reflow", test: "At 320px wide (or 400% zoom) there is no horizontal scrolling." },
      { sc: "1.4.11", name: "Non-text contrast", test: "Icons, input borders, and focus rings are at least 3:1 against adjacent colors." },
    ],
  },
  {
    heading: "Operable",
    intro: "Users must be able to operate the interface with a keyboard, mouse, touch, or switch.",
    items: [
      { sc: "2.1.1", name: "Keyboard", test: "Every action works with only a keyboard; nothing needs a mouse." },
      { sc: "2.4.3", name: "Focus order", test: "Tabbing moves through the page in an order that makes sense." },
      { sc: "2.4.7", name: "Focus visible", test: "You can always see which element has keyboard focus." },
      { sc: "2.4.11", name: "Focus not obscured (new in 2.2)", test: "The focused element is never fully hidden behind sticky headers or footers." },
      { sc: "2.5.8", name: "Target size (new in 2.2)", test: "Click/tap targets are at least 24×24 px, or have spacing that adds up to it." },
    ],
  },
  {
    heading: "Understandable",
    intro: "Content and controls must behave predictably and be written clearly.",
    items: [
      { sc: "3.1.1", name: "Language of page", test: "The <html> element declares the page language." },
      { sc: "3.2.2", name: "On input", test: "Changing a form control never unexpectedly navigates or submits." },
      { sc: "3.3.1", name: "Error identification", test: "Form errors are described in text, next to the field, not just by color." },
      { sc: "3.3.8", name: "Accessible authentication (new in 2.2)", test: "Sign-in never requires memorizing or transcribing. Magic links and paste-able codes pass." },
    ],
  },
  {
    heading: "Robust",
    intro: "Content must work with current and future assistive technologies.",
    items: [
      { sc: "4.1.2", name: "Name, role, value", test: "Custom controls expose a name, role, and state to assistive tech (use real buttons and inputs where possible)." },
      { sc: "4.1.3", name: "Status messages", test: "Toasts and inline confirmations use live regions so screen readers announce them." },
    ],
  },
];

export default function WcagChecklistPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "WCAG 2.2 AA checklist in plain English",
          description:
            "The key WCAG 2.2 Level A and AA success criteria as a practical checklist grouped by POUR, with a plain-English test for each.",
          author: { "@type": "Organization", name: "TheWCAG" },
          url: `${SITE_URL}/wcag-checklist`,
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">WCAG 2.2 AA checklist</h1>
        <p className="mt-3 max-w-2xl text-muted">
          This page highlights frequently tested criteria across the four POUR principles, each with a plain-language starting point. It is not the complete standard and does not replace normative WCAG guidance. The desktop app includes every WCAG 2.2 Level A and AA criterion applicable to your selected target, manual verification prompts, W3C references, notes, and finding traceability.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/download"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Open the complete checklist in the app
          </Link>
          <Link
            href="/wcag-contrast"
            className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-card"
          >
            Contrast guide
          </Link>
        </div>

        {GROUPS.map((g) => (
          <section key={g.heading} className="mt-14" aria-labelledby={g.heading}>
            <h2 id={g.heading} className="text-xl font-bold tracking-tight">
              {g.heading}
            </h2>
            <p className="mt-2 text-sm text-muted">{g.intro}</p>
            <ul className="mt-5 space-y-4">
              {g.items.map((c) => (
                <li key={c.sc} className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold">
                    <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">{c.sc}</span>
                    {c.name}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted">{c.test}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-14 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Use the complete checklist inside the audit</h2>
          <p className="mt-2 text-sm text-muted">
            TheWCAG combines deterministic tools for contrast and target measurement with guided manual decisions for every supported Level A and AA criterion. Failed criteria link to findings, not-applicable decisions require rationale at delivery, and exports preserve the complete decision record.
          </p>
          <Link
            href="/download"
            className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download free for macOS &amp; Windows
          </Link>
        </section>
        <ProductLinks heading="Use the checklist inside a complete audit record" />
      </main>
      <Footer />
    </>
  );
}
