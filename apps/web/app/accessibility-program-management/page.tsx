import type { Metadata } from "next";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductLinks } from "@/components/ProductLinks";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Program Management Dashboard",
  description:
    "Track recurrence, median retest time, component hotspots, and regressions from owned accessibility audits without turning untested work into a score.",
  path: "/accessibility-program-management",
  keywords: [
    "accessibility program management",
    "accessibility regression tracking",
    "accessibility remediation dashboard",
    "accessibility component hotspots",
    "accessibility retest metrics",
  ],
});

const METRICS = [
  ["Observed recurrence", "Previously verified component failures that appear again in a later owned audit, divided by the eligible verified component findings with timestamped follow-up."],
  ["Median retest time", "The median elapsed time from an explicit Ready for retest transition to the later Verified fixed decision."],
  ["Component hotspots", "Confirmed finding records grouped by representative sample items of type Component, with affected criteria and audit context."],
  ["Regression rate", "Verified findings that later return to an unresolved local state, divided by eligible findings with the required status history."],
] as const;

export default function AccessibilityProgramManagementPage() {
  return (
    <>
      <Header />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Accessibility audit software", path: "/accessibility-audit-software" },
            { name: "Program management", path: "/accessibility-program-management" },
          ]),
          {
            "@type": "WebPage",
            name: "Accessibility program management dashboard",
            url: `${SITE_URL}/accessibility-program-management`,
            description: metadata.description,
            isPartOf: { "@type": "WebSite", name: "TheWCAG", url: SITE_URL },
          },
        ],
      }} />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-12">
        <h1>Accessibility program trends grounded in owned audit history</h1>
        <p>
          TheWCAG uses confirmed findings, stable component references, remediation transitions, and retest decisions already stored in local audits. It shows operational patterns without inventing a pass rate, conformance score, or percentage that hides untested criteria.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="button button--primary">Open the local Program dashboard</Link>
          <Link href="/getting-started#after-delivery" className="button button--secondary">Read the follow-up guide</Link>
        </div>

        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading">Four operational metrics with explicit denominators</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left type-body">
              <thead><tr><th scope="col">Metric</th><th scope="col">How it is calculated</th></tr></thead>
              <tbody>{METRICS.map(([name, detail]) => <tr key={name}><th scope="row">{name}</th><td>{detail}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="data-heading">
          <h2 id="data-heading">Only local or owned data enters the calculation</h2>
          <ol className="audit-software-workflow mt-6">
            <li><span aria-hidden="true">1</span><div><h3>Stable finding history</h3><p>The calculation follows the local finding reference, status timestamps, mapped component sample, WCAG criteria, and audit date.</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>Eligible records only</h3><p>Records without the timestamps or relationships needed by a metric are counted as excluded and explained instead of being guessed.</p></div></li>
            <li><span aria-hidden="true">3</span><div><h3>Guided demo excluded</h3><p>Training data from the first-run sample never enters program results.</p></div></li>
            <li><span aria-hidden="true">4</span><div><h3>No upload required</h3><p>The desktop dashboard computes the trends from audit data already owned by the user.</p></div></li>
          </ol>
        </section>

        <section aria-labelledby="guardrails-heading">
          <h2 id="guardrails-heading">The dashboard refuses the misleading shortcuts</h2>
          <dl className="mt-5">
            <div><dt className="font-semibold">No automated pass-rate score</dt><dd>Operational improvement and product conformance are different questions. The dashboard does not merge them.</dd></div>
            <div><dt className="font-semibold">No hidden untested criteria</dt><dd>Complete samples, in-progress work, blocked gaps, not-started samples, criterion decisions, and untested criteria remain raw visible counts.</dd></div>
            <div><dt className="font-semibold">No “not observed again” equals pass</dt><dd>Absence of a repeated finding is reported as not observed again. It is not converted into a new criterion decision.</dd></div>
            <div><dt className="font-semibold">No color-only chart meaning</dt><dd>Every chart has text labels and a data-table equivalent so the exact values and denominators are available to keyboard and screen-reader users.</dd></div>
          </dl>
        </section>

        <section aria-labelledby="use-heading">
          <h2 id="use-heading">Use trends to decide where to investigate</h2>
          <p className="mt-3">A recurring component failure can justify design-system remediation. Long retest times can expose handoff friction. A hotspot can identify a shared control that needs focused review. A regression can trigger a root-cause discussion. None of those signals replaces criterion-by-criterion testing in the next audit.</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6" aria-labelledby="score-heading">
          <h2 id="score-heading">If the evidence is unavailable, the metric says unavailable</h2>
          <p className="mt-3">The dashboard explains which timestamp or relationship is missing. It does not fill the gap with zero, infer success, or present incomplete data as conformance.</p>
        </section>

        <ProductLinks heading="Build program history from defensible audits" description="Plan representative samples, keep evidence with stable findings, record remediation transitions, and review trends only when the data supports them." />
      </main>
      <Footer />
    </>
  );
}
