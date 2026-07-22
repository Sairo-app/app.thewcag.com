import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductLinks } from "@/components/ProductLinks";
import { CheckIcon } from "@/components/icons";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Accessible Audit Reporting Software and VPAT Authoring",
  description:
    "Create branded WCAG audit reports in accessible HTML, PDF, and Markdown, choose audience sections, and author every VPAT response manually.",
  path: "/accessibility-reporting-software",
  keywords: [
    "accessibility reporting software",
    "WCAG audit report software",
    "VPAT authoring software",
    "accessibility conformance report tool",
    "accessible PDF report",
  ],
});

const OUTPUTS = [
  ["Accessible HTML", "Semantic heading order, document title and language, descriptive links, accessible tables, print styles, and report metadata."],
  ["PDF", "A branded PDF workflow generated from the same structured report, with the selected audience sections and human-authored conclusions."],
  ["Portable Markdown", "A reviewable text record for repositories, handoff notes, and durable local storage without a hosted account."],
  ["Unlisted web report", "A deliberately published page with keyboard jump links, finding filters, annotated-evidence lightbox, white-label branding, and clean printing."],
] as const;

const AUDIENCES = [
  ["Complete audit", "Executive summary, limitations, prioritized action plan, detailed findings, evidence inventory, and criterion decisions."],
  ["Executive", "The decision context and limitations without hiding the scope or turning unresolved work into a score."],
  ["Delivery", "Prioritized remediation details for product and engineering teams, with stable finding references and evidence links."],
] as const;

export default function AccessibilityReportingSoftwarePage() {
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
              { name: "Accessible reporting", path: "/accessibility-reporting-software" },
            ]),
            {
              "@type": "WebPage",
              name: "Accessible audit reporting software and VPAT authoring",
              url: `${SITE_URL}/accessibility-reporting-software`,
              description: metadata.description,
              isPartOf: { "@type": "WebSite", name: "TheWCAG", url: SITE_URL },
            },
          ],
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1>Accessible audit reports without automated conformance claims</h1>
        <p>
          TheWCAG turns a reviewed local audit into a branded report for the people who must act on it. Choose the audience and format, preserve finding-to-evidence traceability, and require a human response for every VPAT or Accessibility Conformance Report criterion.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="button button--primary">Create a local audit report</Link>
          <Link href="/getting-started#deliver" className="button button--secondary">Follow the delivery guide</Link>
        </div>

        <figure className="guide-figure">
          <div className="guide-figure__image">
            <Image
              src="/guides/getting-started/04-review-findings.png"
              alt="TheWCAG Review stage showing accessible report format and audience controls, review metrics, and a VPAT authoring scaffold with zero human responses."
              width={1191}
              height={768}
              priority
            />
          </div>
          <figcaption><p><strong>Human decisions stay visible.</strong> A completed checklist does not populate the VPAT response column.</p></figcaption>
        </figure>

        <section aria-labelledby="formats-heading">
          <h2 id="formats-heading">One audit record, four delivery paths</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th scope="col">Output</th><th scope="col">What it preserves</th></tr></thead>
              <tbody>
                {OUTPUTS.map(([name, detail]) => <tr key={name}><th scope="row">{name}</th><td>{detail}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="accessible-heading">
          <h2 id="accessible-heading">Accessibility is part of the export structure</h2>
          <ul className="mt-5 space-y-3">
            <li className="flex gap-2"><CheckIcon size={16} />A single page title and ordered headings describe the report hierarchy.</li>
            <li className="flex gap-2"><CheckIcon size={16} />Tables include captions, column headers, and row headers where the relationship requires them.</li>
            <li className="flex gap-2"><CheckIcon size={16} />Links name their destination instead of relying on “click here” or raw URLs.</li>
            <li className="flex gap-2"><CheckIcon size={16} />Language, title, authoring metadata, limitations, and completion context travel with the document.</li>
            <li className="flex gap-2"><CheckIcon size={16} />Automated accessibility checks are quality signals for the report template, never proof that the audited product conforms.</li>
          </ul>
        </section>

        <section aria-labelledby="audience-heading">
          <h2 id="audience-heading">Choose sections for the reader, not a different truth</h2>
          <dl className="mt-5">
            {AUDIENCES.map(([name, detail]) => <div key={name}><dt className="font-semibold">{name}</dt><dd>{detail}</dd></div>)}
          </dl>
          <p className="mt-4">Executive summary, limitations, and prioritized action plan can be toggled independently. Findings, evidence, scope, and unresolved work do not become passes simply because a shorter audience preset is selected.</p>
        </section>

        <section aria-labelledby="vpat-heading">
          <h2 id="vpat-heading">A VPAT scaffold that waits for the auditor</h2>
          <p className="mt-3">
            The authoring table starts every WCAG criterion at <strong>Auditor response required</strong>. Pass, fail, N/A, contrast measurements, automated signals, and finding counts may inform the auditor, but none can generate “Supports”, “Partially Supports”, “Does Not Support”, or “Not Applicable”.
          </p>
          <ol className="audit-software-workflow mt-6">
            <li><span aria-hidden="true">1</span><div><h3>Review the criterion evidence</h3><p>Read the checklist decision, test notes, findings, linked captures, limitations, and the relevant product scope.</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>Enter the conformance response</h3><p>Select the response only after applying professional judgment to the full record.</p></div></li>
            <li><span aria-hidden="true">3</span><div><h3>Write remarks and explanations</h3><p>State the product behavior, scope, exceptions, known gaps, and evidence a reader needs to understand the response.</p></div></li>
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-6" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading">The report records a decision; it does not manufacture one</h2>
          <p className="mt-3">TheWCAG supports report quality, traceability, and authoring. The auditor remains responsible for test coverage, criterion interpretation, limitations, conformance responses, and the final claim.</p>
        </section>

        <ProductLinks heading="Connect reporting to the complete audit record" description="Keep planning, finding-owned evidence, remediation tickets, human WCAG decisions, and delivery in one local workflow." />
      </main>
      <Footer />
    </>
  );
}
