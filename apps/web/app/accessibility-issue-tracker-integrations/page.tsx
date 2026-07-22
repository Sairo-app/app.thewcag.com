import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductLinks } from "@/components/ProductLinks";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Issue Tracker Integrations",
  description:
    "Create Jira, Linear, or GitHub Issues from complete accessibility findings, map audit fields, and review external status conflicts before applying changes.",
  path: "/accessibility-issue-tracker-integrations",
  keywords: [
    "accessibility Jira integration",
    "Linear accessibility issues",
    "GitHub accessibility issue template",
    "accessibility issue tracker integration",
    "WCAG remediation tickets",
  ],
});

const CONNECTORS = [
  ["Jira", "Project and issue-type configuration with field mapping for Jira Cloud workflows."],
  ["Linear", "Team-based issue creation using the same reviewed finding record and configurable field destinations."],
  ["GitHub Issues", "Repository issue creation with a complete accessibility description, remediation context, and evidence link."],
] as const;

const MAPPINGS = [
  ["Title", "Stable finding reference and concise issue title"],
  ["Description", "Barrier summary and affected location"],
  ["Actual result", "Observable behavior recorded by the auditor"],
  ["Expected result", "Accessible behavior the product should provide"],
  ["User impact", "Affected users, disrupted task, and workaround context"],
  ["WCAG mapping", "Human-confirmed criterion reference"],
  ["Severity", "Blocker, major, or minor with local rationale"],
  ["Evidence link", "Reviewed report or test-evidence URL"],
  ["Owner", "Responsible team or person"],
  ["Target date", "Planned remediation date"],
] as const;

export default function AccessibilityIssueTrackerIntegrationsPage() {
  return (
    <>
      <Header />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Accessibility audit software", path: "/accessibility-audit-software" },
            { name: "Issue tracker integrations", path: "/accessibility-issue-tracker-integrations" },
          ]),
          {
            "@type": "WebPage",
            name: "Accessibility issue tracker integrations",
            url: `${SITE_URL}/accessibility-issue-tracker-integrations`,
            description: metadata.description,
            isPartOf: { "@type": "WebSite", name: "TheWCAG", url: SITE_URL },
          },
        ],
      }} />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1>Create remediation tickets without retyping the finding</h1>
        <p>
          Send a reviewed accessibility finding to Jira, Linear, or GitHub Issues with its evidence and audit context intact. Configure the mapping once, retain the returned ticket key and URL, and review external changes beside the local auditor decision.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="button button--primary">Create a ticket from TheWCAG</Link>
          <Link href="/getting-started#review" className="button button--secondary">Read the ticket workflow</Link>
        </div>

        <figure className="guide-figure">
          <div className="guide-figure__image">
            <Image
              src="/guides/getting-started/ticket-integrations.png"
              alt="TheWCAG finding editor showing remediation status, owner, target date, evidence link, and the Create ticket panel with Jira and field-mapping controls."
              width={1191}
              height={768}
              priority
            />
          </div>
          <figcaption><p><strong>The finding is the source record.</strong> External status is displayed separately and cannot silently replace the local decision.</p></figcaption>
        </figure>

        <section aria-labelledby="connectors-heading">
          <h2 id="connectors-heading">Three connectors, one field model</h2>
          <dl className="mt-5">
            {CONNECTORS.map(([name, detail]) => <div key={name}><dt className="font-semibold">{name}</dt><dd>{detail}</dd></div>)}
          </dl>
        </section>

        <section aria-labelledby="mapping-heading">
          <h2 id="mapping-heading">Configurable finding-to-ticket mapping</h2>
          <p className="mt-3">Each connector maps the same reviewed finding fields into the destination&apos;s available fields. Unmapped values can remain in the generated description so context is not discarded.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th scope="col">Finding field</th><th scope="col">Ticket content</th></tr></thead>
              <tbody>{MAPPINGS.map(([field, content]) => <tr key={field}><th scope="row">{field}</th><td>{content}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="sync-heading">
          <h2 id="sync-heading">Two-way visibility without silent authority transfer</h2>
          <ol className="audit-software-workflow mt-6">
            <li><span aria-hidden="true">1</span><div><h3>Create the external ticket</h3><p>TheWCAG stores the returned connector, ticket key, URL, and last synchronized external state on the finding.</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>Re-sync when you choose</h3><p>The current external status is fetched and displayed beside the local remediation status.</p></div></li>
            <li><span aria-hidden="true">3</span><div><h3>Review conflicts</h3><p>If the external state differs from the last synchronized state or the local auditor decision, the finding moves to Review needed. Nothing is applied automatically.</p></div></li>
            <li><span aria-hidden="true">4</span><div><h3>Keep the auditor decision explicit</h3><p>Ready for retest, verified fixed, risk accepted, and other local outcomes change only through an auditor action in TheWCAG.</p></div></li>
          </ol>
        </section>

        <section aria-labelledby="security-heading">
          <h2 id="security-heading">Credentials stay out of the renderer</h2>
          <p className="mt-3">Connector credentials are configured and stored in the desktop main process behind the existing allowlisted IPC boundary. The finding editor receives bounded configuration and sync results, never the stored Jira, Linear, or GitHub secret.</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6" aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">A ticket is a remediation handoff, not the audit record</h2>
          <p className="mt-3">The external issue helps a delivery team act. The local finding remains the authoritative evidence, WCAG mapping, auditor status, retest history, and report source.</p>
        </section>

        <ProductLinks heading="Keep remediation connected to review and delivery" description="Create tickets from complete findings, then bring reviewed status changes back into the local audit record." />
      </main>
      <Footer />
    </>
  );
}
