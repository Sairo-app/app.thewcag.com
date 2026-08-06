import type { Metadata } from "next";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuditPlayground } from "@/components/HomeExperience";
import { createPageMetadata, SITE_URL } from "@/lib/seo";
import { SAMPLE_REPORT_SLUG } from "@/lib/sample-report";
import {
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ContrastIcon,
  CropIcon,
  FileCheckIcon,
  LinkIcon,
  SparklesIcon,
  WindowsIcon,
} from "@/components/icons";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Audit Software That Keeps the Proof",
  description:
    "Capture rendered accessibility barriers, keep evidence attached to WCAG findings, adapt to optional agency audit templates, and deliver review-ready reports from one local-first workspace.",
  path: "/",
  keywords: ["accessibility audit software", "WCAG audit tool", "accessibility testing app", "audit template AI", "accessibility evidence capture"],
});

const WORKFLOW = [
  ["Set the format", "Start immediately with TheWCAG, or add a client's workbook so AI can learn its sheets, fields, allowed values, and examples."],
  ["Capture the barrier", "Inspect any rendered interface and keep annotated visual evidence, semantics, and reproduction context together."],
  ["Review the decision", "Confirm user impact, severity, WCAG mapping, ownership, remediation, and the exact language that will leave the audit."],
  ["Deliver the record", "Export to the original agency format, create an accessible report, open a ticket, or publish only what you approve."],
] as const;

const CAPABILITIES = [
  {
    icon: SparklesIcon,
    eyebrow: "Adapt",
    title: "Optional audit-template intelligence",
    body: "Upload an existing audit sheet when a client has one. The project learns how issues must be written without making a template mandatory.",
    href: "/accessibility-audit-software",
  },
  {
    icon: CropIcon,
    eyebrow: "Capture",
    title: "Evidence from the rendered interface",
    body: "Annotate temporary states across websites and desktop apps, with browser semantics attached when they are available.",
    href: "/screenshot-tool",
  },
  {
    icon: ContrastIcon,
    eyebrow: "Inspect",
    title: "Contrast and vision instruments",
    body: "Sample any screen pixel and simulate color-vision deficiencies, low acuity, and reduced contrast across applications.",
    href: "/color-contrast-checker",
  },
  {
    icon: BookIcon,
    eyebrow: "Decide",
    title: "Human-owned WCAG review",
    body: "Work criterion by criterion with guided checks, clear traceability, and no automated claim of conformance.",
    href: "/wcag-checklist",
  },
  {
    icon: LinkIcon,
    eyebrow: "Coordinate",
    title: "Remediation without retyping",
    body: "Send complete, reviewed findings to Jira, Linear, or GitHub Issues and preserve the audit as the source of truth.",
    href: "/accessibility-issue-tracker-integrations",
  },
  {
    icon: FileCheckIcon,
    eyebrow: "Deliver",
    title: "Accessible reports and retests",
    body: "Create audience-specific HTML or PDF reports, author VPAT responses explicitly, and retain before-and-after evidence.",
    href: "/accessibility-reporting-software",
  },
] as const;

export default function Home() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", name: "TheWCAG", alternateName: "The WCAG", url: SITE_URL },
            {
              "@type": "SoftwareApplication",
              name: "TheWCAG",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Windows",
              url: SITE_URL,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              description: metadata.description,
              featureList: ["Optional audit template analysis", "Finding-owned evidence", "WCAG 2.2 checklist", "Issue tracker integrations", "Accessible reports", "Retesting"],
            },
          ],
        }}
      />

      <main id="main" className="home home-v2">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-shell home-hero__inner">
            <div className="home-hero__intro">
              <div className="home-hero__copy">
                <p className="home-hero__eyebrow"><span /> Accessibility audit workstation</p>
                <h1 id="home-heading"><span>Every finding</span><span>keeps its proof.</span></h1>
                <p className="home-hero__lead">
                  Capture what users experience, make defensible WCAG decisions, and deliver in the format your team or client expects—from one local-first workspace.
                </p>
                <div className="home-actions">
                  <Link href="/download" className="button button--primary">Download free <ArrowRightIcon size={16} /></Link>
                  <Link href="/getting-started" className="button button--secondary">Explore the workflow</Link>
                  <Link href={`/s/${SAMPLE_REPORT_SLUG}`} className="button button--secondary">See a sample report</Link>
                </div>
                <div className="home-hero__assurances" aria-label="Product assurances">
                  <span><CheckIcon size={16} /> No account to start</span>
                  <span><CheckIcon size={16} /> Template is optional</span>
                  <span><CheckIcon size={16} /> macOS + Windows</span>
                </div>
              </div>
              <div className="home-hero__stage"><AuditPlayground /></div>
            </div>
          </div>
        </section>

        <aside className="home-proof" aria-label="Core product facts">
          <div className="home-shell home-proof__inner">
            <span><small>01</small> Local by default</span>
            <span><small>02</small> Evidence stays attached</span>
            <span><small>03</small> Human-reviewed decisions</span>
            <span><small>04</small> WCAG 2.2 workflow</span>
          </div>
        </aside>

        <section className="home-workflow" aria-labelledby="workflow-heading">
          <div className="home-shell home-workflow__grid">
            <div className="section-heading section-heading--sticky">
              <p className="section-heading__kicker">One continuous record</p>
              <h2 id="workflow-heading">An audit is a chain of decisions—not a pile of screenshots.</h2>
              <p>Each stage adds context without breaking the trace back to the original barrier.</p>
            </div>
            <ol className="workflow-list">
              {WORKFLOW.map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-template" aria-labelledby="template-heading">
          <div className="home-shell home-template__grid">
            <div className="home-template__copy">
              <p className="section-heading__kicker">Your format, when you need it</p>
              <h2 id="template-heading">Bring the audit sheet. Keep its rules.</h2>
              <p>
                Agencies do not all use the same workbook. At project setup, you can add an existing file and let AI build a project-specific logging guide from its structure. Skip the upload and the native workflow is ready immediately.
              </p>
              <ul>
                <li><CheckIcon size={16} /><span><strong>Understands structure</strong> Sheets, headers, required fields, option lists, examples, and formulas.</span></li>
                <li><CheckIcon size={16} /><span><strong>Guides every finding</strong> Drafts follow the learned field order, vocabulary, and level of detail.</span></li>
                <li><CheckIcon size={16} /><span><strong>Keeps people in control</strong> Review the mapping before use and edit every AI-suggested value.</span></li>
              </ul>
              <Link href="/accessibility-audit-software" className="home-text-link">See the complete audit workflow <ArrowRightIcon size={16} /></Link>
            </div>

            <div className="template-sheet" aria-label="Example agency template mapping">
              <div className="template-sheet__header">
                <div><span className="template-sheet__mark">W</span><div><strong>Project format</strong><small>Agency-audit-template.xlsx</small></div></div>
                <span className="template-sheet__ready"><i /> Ready</span>
              </div>
              <div className="template-sheet__tabs"><span className="is-active">Findings</span><span>Summary</span><span>Lists</span></div>
              <div className="template-sheet__columns"><span>A</span><span>B</span><span>C</span><span>D</span></div>
              <div className="template-sheet__table" role="table" aria-label="Mapped finding fields">
                <div role="row"><span role="columnheader">Source meaning</span><span role="columnheader">Workbook field</span><span role="columnheader">Rule</span></div>
                <div role="row"><span role="cell">Issue title</span><strong role="cell">Summary</strong><small role="cell">Required</small></div>
                <div role="row"><span role="cell">WCAG criterion</span><strong role="cell">Success Criteria</strong><small role="cell">List</small></div>
                <div role="row"><span role="cell">User impact</span><strong role="cell">Impact Description</strong><small role="cell">Required</small></div>
                <div role="row"><span role="cell">Remediation</span><strong role="cell">Recommendation</strong><small role="cell">Example learned</small></div>
              </div>
              <div className="template-sheet__footer"><SparklesIcon size={16} /><span><strong>7 fields mapped</strong> · Confirmed for this project</span></div>
            </div>
          </div>
        </section>

        <section className="home-tools" aria-labelledby="tools-heading">
          <div className="home-shell">
            <div className="section-heading section-heading--compact">
              <p className="section-heading__kicker">One workstation</p>
              <h2 id="tools-heading">The whole evidence trail, without the tool pile.</h2>
              <p>Use each instrument independently or let it contribute to one reviewable audit record.</p>
            </div>
            <div className="capability-map">
              {CAPABILITIES.map((capability, index) => {
                const Icon = capability.icon;
                return (
                  <Link key={capability.title} href={capability.href} className="capability-map__item">
                    <span className="capability-map__number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="capability-map__icon" aria-hidden="true"><Icon size={20} /></span>
                    <span className="capability-map__copy"><small>{capability.eyebrow}</small><strong>{capability.title}</strong><span>{capability.body}</span></span>
                    <span className="capability-map__arrow" aria-hidden="true"><ArrowRightIcon size={16} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-platforms" aria-labelledby="platforms-heading">
          <div className="home-shell">
            <div className="section-heading">
              <p className="section-heading__kicker">Start locally</p>
              <h2 id="platforms-heading">Choose your desktop. Keep the audit on it.</h2>
              <p>The core workstation is free on macOS and Windows. Sign in only when you want a connected service.</p>
            </div>
            <div className="platform-grid">
              <article className="platform-panel platform-panel--mac">
                <div className="platform-panel__number">01 / macOS</div>
                <div className="platform-panel__icon"><AppleIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy"><h3>Built for macOS</h3><p>Universal Apple Silicon and Intel build with menu-bar access and clear permission recovery.</p><ul><li><CheckIcon size={16} /> macOS 12 or later</li><li><CheckIcon size={16} /> Signed and notarized</li><li><CheckIcon size={16} /> High-DPI capture</li></ul></div>
                <a href="/api/desktop/download?os=mac" className="button button--primary">Download for macOS <ArrowRightIcon size={16} /></a>
              </article>
              <article className="platform-panel platform-panel--windows">
                <div className="platform-panel__number">02 / Windows</div>
                <div className="platform-panel__icon"><WindowsIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy"><h3>Built for Windows</h3><p>Windows-aware controls, native shortcut labels, and sharp output across high-DPI displays.</p><ul><li><CheckIcon size={16} /> Windows 10 and 11</li><li><CheckIcon size={16} /> 64-bit installer</li><li><CheckIcon size={16} /> Multi-display ready</li></ul></div>
                <a href="/api/desktop/download?os=windows" className="button button--secondary">Download for Windows <ArrowRightIcon size={16} /></a>
              </article>
            </div>
          </div>
        </section>

        <section className="home-trust" aria-labelledby="trust-heading">
          <div className="home-shell home-trust__inner">
            <div><p className="section-heading__kicker">Trust by architecture</p><h2 id="trust-heading">Private until you choose otherwise.</h2><p>Audit work stays on your computer until you deliberately use a connected service.</p></div>
            <div className="home-trust__details">
              <article><span>01</span><div><h3>Capture locally</h3><p>Screenshots, annotations, finding drafts, and checklists do not upload simply because you created them.</p></div></article>
              <article><span>02</span><div><h3>Review before AI</h3><p>You control the provider, the evidence sent, and every suggested field. AI assists authoring; it does not decide conformance.</p></div></article>
              <article><span>03</span><div><h3>Publish deliberately</h3><p>Hosted reports contain only the approved image, findings, and branding you choose to share.</p></div></article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
