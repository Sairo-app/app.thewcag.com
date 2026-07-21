import type { Metadata } from "next";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductLinks } from "@/components/ProductLinks";
import { CheckIcon } from "@/components/icons";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Audit Software for macOS and Windows",
  description:
    "Plan WCAG 2.2 audits, capture annotated evidence, manage findings, retest fixes, and deliver accessible reports with TheWCAG for macOS and Windows.",
  path: "/accessibility-audit-software",
  keywords: [
    "accessibility audit software",
    "WCAG audit tool",
    "accessibility testing software",
    "macOS accessibility audit app",
    "Windows accessibility audit tool",
  ],
});

const WORKFLOW = [
  ["Plan", "Define the evaluation goal, included and excluded scope, representative sample, browser and device matrix, assistive technologies, and methodology."],
  ["Inspect", "Use screen-wide contrast inspection, target measurement, palette analysis, vision simulation, and guided test runs across web and native interfaces."],
  ["Evidence", "Capture high-DPI screenshots, annotate barriers, link browser evidence, and keep every finding tied to its location and supporting proof."],
  ["Review", "Triage severity, ownership, WCAG mapping, repeated occurrences, accepted risk, remediation dates, and before-and-after retest evidence."],
  ["Deliver", "Run readiness checks, distinguish focused reviews from complete audits, then export a portable record or publish a controlled report."],
] as const;

const CAPABILITIES = [
  ["Evaluation planning", "Goals, scope, exclusions, representative samples, environments, assistive technologies, and reusable audit templates."],
  ["Guided manual testing", "Structured scripts for authentication, checkout, forms, media, documents, components, and regression work."],
  ["Evidence capture", "Region and full-screen capture, issue badges, arrows, measurements, contrast probes, focus order, text, crop, and redaction."],
  ["Findings management", "Stable references, affected users, severity rationale, owners, tickets, dates, repeated occurrences, and retest history."],
  ["WCAG 2.2 checklist", "Level A or AA scope, manual verification prompts, W3C references, notes, traceability, decision shortcuts, and undo."],
  ["Audit delivery", "Markdown, printable HTML, portable integrity-checked audit packages, privacy checks, and optional public review links."],
] as const;

export default function AccessibilityAuditSoftwarePage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Accessibility audit software", path: "/accessibility-audit-software" },
            ]),
            {
              "@type": "SoftwareApplication",
              name: "TheWCAG",
              url: `${SITE_URL}/accessibility-audit-software`,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Windows",
              description: metadata.description,
              featureList: CAPABILITIES.map(([title]) => title),
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            },
          ],
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1>Accessibility audit software built around evidence</h1>
        <p>
          TheWCAG is a local-first audit workstation for professional accessibility evaluation. It keeps planning, manual testing, screenshots, findings, WCAG decisions, remediation, retesting, and delivery in one project record.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="button button--primary">Download for macOS or Windows</Link>
          <Link href="/chrome-accessibility-extension" className="button button--secondary">Explore browser evidence capture</Link>
        </div>

        <section aria-labelledby="workflow-heading">
          <h2 id="workflow-heading">One continuous audit workflow</h2>
          <ol className="audit-software-workflow mt-6">
            {WORKFLOW.map(([title, body], index) => (
              <li key={title}>
                <span aria-hidden="true">{index + 1}</span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="capabilities-heading">
          <h2 id="capabilities-heading">What is included</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th scope="col">Area</th><th scope="col">Built-in support</th></tr></thead>
              <tbody>
                {CAPABILITIES.map(([title, body]) => (
                  <tr key={title}><th scope="row">{title}</th><td>{body}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="local-heading">
          <h2 id="local-heading">Local by default, connected when useful</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3>Works without an account</h3>
              <ul className="mt-3 space-y-2">
                <li className="flex gap-2"><CheckIcon size={16} />Audit plans, captures, findings, checklists, exports, and packages stay on your computer.</li>
                <li className="flex gap-2"><CheckIcon size={16} />No screenshot or DOM evidence is uploaded simply because it was captured.</li>
              </ul>
            </div>
            <div>
              <h3>Website services are explicit</h3>
              <ul className="mt-3 space-y-2">
                <li className="flex gap-2"><CheckIcon size={16} />Sign in through the system browser to enable AI drafts and report publishing.</li>
                <li className="flex gap-2"><CheckIcon size={16} />Choose the exact evidence sections included before generation or sharing.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6" aria-labelledby="audience-heading">
          <h2 id="audience-heading">For auditors who need a defensible record</h2>
          <p className="mt-3">
            Use TheWCAG for internal audits, consultancy work, procurement reviews, design-system checks, regression testing, and remediation verification. It supports the evidence trail, but it does not claim that automation alone can determine conformance.
          </p>
        </section>

        <ProductLinks />
      </main>
      <Footer />
    </>
  );
}
