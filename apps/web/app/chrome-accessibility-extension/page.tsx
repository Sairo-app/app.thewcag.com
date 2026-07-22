import type { Metadata } from "next";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductLinks } from "@/components/ProductLinks";
import { CheckIcon } from "@/components/icons";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

const REPOSITORY = "https://github.com/Sairo-app/app.thewcag.com/tree/main/apps/extension";

export const metadata: Metadata = createPageMetadata({
  title: "Chrome Accessibility Extension for Audit Evidence",
  description:
    "Mark an accessibility issue on a webpage, capture contextual screenshot and semantic evidence, draft a structured WCAG finding, and save it to TheWCAG desktop.",
  path: "/chrome-accessibility-extension",
  keywords: [
    "Chrome accessibility extension",
    "accessibility audit browser extension",
    "WCAG issue capture extension",
    "accessibility screenshot extension",
    "AI accessibility finding generator",
  ],
});

const FLOW = [
  ["Mark the barrier", "Choose one element or drag around a region on a regular webpage. The extension receives temporary access only after your action."],
  ["Review the evidence", "Inspect the contextual screenshot, orange target marker, sanitized selector, accessible name, role, state, nearby heading, and bounded DOM excerpt."],
  ["Describe what happened", "Add the behavior you observed and the task the user was trying to complete. Deterministic checks remain separate from your conclusion."],
  ["Control the payload", "Include or withhold the screenshot, element text, and sanitized page address before any AI request leaves the computer."],
  ["Confirm the finding", "Review and edit the title, actual and expected results, impact, severity, affected users, WCAG mapping, resolution, and reproduction steps."],
  ["Save to the audit", "The desktop bridge writes the confirmed evidence and finding into the selected local audit without exposing its account credential to Chrome."],
] as const;

const FAQ = [
  {
    q: "Does the extension scan every website I visit?",
    a: "No. It uses Chrome's temporary activeTab permission after you start a capture from the toolbar. It does not request permanent access to every site.",
  },
  {
    q: "Why can it not inspect chrome:// pages?",
    a: "Chrome blocks extensions from injecting into browser-owned and other protected pages. Open a regular HTTP or HTTPS page to capture evidence.",
  },
  {
    q: "Is AI required?",
    a: "No. Local capture and a deterministic structured draft work without AI. AI authoring requires a connected, signed-in desktop app and explicit payload approval.",
  },
  {
    q: "Where is the Chrome Web Store link?",
    a: "The source build is available now for internal and developer testing. The public Chrome Web Store listing and final privacy disclosures are still in release preparation.",
  },
] as const;

export default function ChromeAccessibilityExtensionPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Chrome accessibility extension", path: "/chrome-accessibility-extension" },
            ]),
            {
              "@type": "SoftwareApplication",
              name: "TheWCAG Evidence Capture",
              url: `${SITE_URL}/chrome-accessibility-extension`,
              applicationCategory: "BrowserApplication",
              operatingSystem: "Chrome on macOS and Windows",
              description: metadata.description,
              isPartOf: { "@type": "SoftwareApplication", name: "TheWCAG" },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1>Chrome evidence capture for accessibility auditors</h1>
        <p>
          TheWCAG&apos;s Chrome extension turns a browser observation into reviewable audit evidence. It captures page context and semantics around the control you selected, then helps create a structured finding without pretending that automation made the final decision.
        </p>

        <div className="release-note mt-8" role="note">
          <strong>Public listing in preparation</strong>
          <p>The extension source and production build are available in the repository for testing. Chrome Web Store packaging, listing review, and final privacy disclosures are the remaining distribution steps.</p>
          <a href={REPOSITORY} target="_blank" rel="noreferrer">View extension source</a>
        </div>

        <section aria-labelledby="capture-flow-heading">
          <h2 id="capture-flow-heading">From selected control to confirmed finding</h2>
          <ol className="audit-software-workflow mt-6">
            {FLOW.map(([title, body], index) => (
              <li key={title}>
                <span aria-hidden="true">{index + 1}</span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="evidence-heading">
          <h2 id="evidence-heading">Evidence with enough context to understand the issue</h2>
          <p className="mt-3">
            A selected button should not become an isolated mystery crop. The extension keeps a bounded part of the surrounding page visible, outlines the exact target in orange, adds a numbered label, and preserves high-DPI output. The screenshot is paired with safe semantic context so an auditor can verify what the image alone cannot show.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Contextual screenshot with the selected control highlighted",
              "Role, accessible name, state, labels, landmark, and nearby heading",
              "Sanitized selector and bounded non-executable DOM excerpt",
              "No passwords, form values, cookies, storage, history, or network bodies",
            ].map((item) => <li key={item} className="flex gap-2"><CheckIcon size={16} />{item}</li>)}
          </ul>
        </section>

        <section aria-labelledby="connection-heading">
          <h2 id="connection-heading">How the extension, desktop app, and website connect</h2>
          <div className="connection-map mt-6">
            <div><strong>Chrome extension</strong><p>Captures the selected webpage evidence and presents the draft for review.</p></div>
            <span aria-hidden="true">→</span>
            <div><strong>Desktop app</strong><p>Owns the audit, validates native messages, stores evidence locally, and keeps the account token out of Chrome.</p></div>
            <span aria-hidden="true">→</span>
            <div><strong>Website service</strong><p>Handles browser sign-in, authorized AI generation, optional report publishing, downloads, and account management.</p></div>
          </div>
          <p className="mt-5">
            Extension-to-desktop communication is local through Chrome Native Messaging. The website is not in that local path. It is contacted by the desktop app only for features that need an authenticated service, such as AI drafting or publishing a report.
          </p>
        </section>

        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading">Extension FAQ</h2>
          <dl className="mt-4">
            {FAQ.map((item) => <div key={item.q}><dt className="font-semibold">{item.q}</dt><dd className="mt-1">{item.a}</dd></div>)}
          </dl>
        </section>

        <ProductLinks
          heading="Keep browser evidence connected to the audit"
          description="Use the extension for fast page-level capture and the desktop workstation for the complete, defensible audit record."
        />
      </main>
      <Footer />
    </>
  );
}
