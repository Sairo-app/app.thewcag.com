import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ArrowRightIcon, CheckIcon, DownloadIcon } from "@/components/icons";
import { GuideDownloadLink, GuideTelemetryConsent } from "@/components/GuideTelemetry";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Getting Started with TheWCAG: Your First Audit",
  description:
    "Capture a website issue from the browser extension or complete a guided four-stage WCAG audit in the desktop app, with evidence kept beside each finding.",
  path: "/getting-started",
  keywords: [
    "TheWCAG getting started",
    "accessibility audit tutorial",
    "WCAG audit workflow",
    "guided accessibility audit",
    "first accessibility audit",
  ],
});

const GUIDE_STEPS = [
  { id: "install", label: "Start locally" },
  { id: "browser-extension", label: "Capture from the browser" },
  { id: "plan", label: "Plan the audit" },
  { id: "inspect", label: "Inspect and add evidence" },
  { id: "review", label: "Review decisions" },
  { id: "deliver", label: "Deliver accessibly" },
  { id: "after-delivery", label: "Manage follow-up" },
] as const;

const howToSteps = [
  ["Install TheWCAG and open the guided sample", "Download the desktop app, launch the bundled local sample, or create a named local audit."],
  ["Choose the browser or desktop starting path", "For a live website, select a component with the optional browser extension, describe the observed issue, approve its evidence payload, and send it to the desktop review queue."],
  ["Plan the evaluation", "Document the scope, methodology, environments, assistive technologies, representative sample, and guided test runs."],
  ["Inspect and attach evidence to findings", "Perform each manual test, record observations, and capture annotated evidence directly inside finding authoring."],
  ["Review findings and WCAG decisions", "Confirm finding details, remediation state, external-ticket changes, and every applicable WCAG criterion decision."],
  ["Deliver an accessible report", "Complete readiness checks and create an audience-specific HTML, PDF, Markdown, or deliberately published report."],
  ["Manage remediation follow-up", "Retest fixes, review program trends, preserve audit packages, and keep standalone screenshot work separate when needed."],
] as const;

function GuideFigure({
  src,
  alt,
  title,
  children,
  priority = false,
}: {
  src: string;
  alt: string;
  title: string;
  children: ReactNode;
  priority?: boolean;
}) {
  return (
    <figure className="guide-figure">
      <div className="guide-figure__image">
        <Image
          src={src}
          alt={alt}
          width={1191}
          height={768}
          sizes="(max-width: 64rem) calc(100vw - 2rem), 900px"
          priority={priority}
        />
      </div>
      <figcaption>
        <p><strong>{title}</strong>{children}</p>
        <a href={src} target="_blank" rel="noreferrer">Open full-size screenshot <ArrowRightIcon size={16} /></a>
      </figcaption>
    </figure>
  );
}

function DoneWhen({ children }: { children: ReactNode }) {
  return (
    <div className="guide-done">
      <CheckIcon size={20} />
      <p><strong>Continue when</strong>{children}</p>
    </div>
  );
}

export default function GettingStartedPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Getting started", path: "/getting-started" },
            ]),
            {
              "@type": "HowTo",
              name: "Complete your first accessibility audit with TheWCAG",
              description: metadata.description,
              tool: [{ "@type": "HowToTool", name: "TheWCAG desktop application" }],
              step: howToSteps.map(([name, text], index) => ({
                "@type": "HowToStep",
                position: index + 1,
                name,
                text,
                url: `${SITE_URL}/getting-started#${GUIDE_STEPS[index].id}`,
              })),
            },
          ],
        }}
      />

      <main id="main" className="guide-page">
        <section className="guide-hero" aria-labelledby="guide-title">
          <span className="guide-eyebrow">First-time guide · four stages · local sample included</span>
          <h1 id="guide-title">Run your first audit with confidence.</h1>
          <p>
            Start from the browser component where a website problem appears, or follow the normal desktop workflow from a bundled, network-free sample. Both paths meet in the same reviewable local finding record. The screenshots below come from the current macOS build; Windows follows the same four-stage structure with platform-specific shortcut labels.
          </p>
          <div className="guide-actions">
            <GuideDownloadLink className="button button--primary"><DownloadIcon size={16} />Download TheWCAG</GuideDownloadLink>
            <a href="#install" className="button button--secondary">Start the guide <ArrowRightIcon size={16} /></a>
          </div>
          <GuideTelemetryConsent />
          <dl className="guide-facts" aria-label="Guide facts">
            <div><dt>Account</dt><dd>Not required for local audits</dd></div>
            <div><dt>Workflow</dt><dd>Plan → Inspect → Review → Deliver</dd></div>
            <div><dt>Outcome</dt><dd>A traceable, accessible audit report</dd></div>
          </dl>
        </section>

        <div className="guide-layout">
          <nav className="guide-toc" aria-label="Getting started sections">
            <span>On this page</span>
            <ol>
              {GUIDE_STEPS.map((step, index) => (
                <li key={step.id}><a href={`#${step.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{step.label}</a></li>
              ))}
            </ol>
          </nav>

          <div className="guide-content">
            <section id="install" className="guide-section">
              <div className="guide-step-heading"><span>01</span><div><p>Before the audit</p><h2>Install and choose your starting point</h2></div></div>
              <p>
                Download the desktop app and open it normally. If no audits exist, TheWCAG offers a bundled Guided sample audit, a blank audit, package import, and the screenshot-only capture library. The sample uses authored local data and never requests a website.
              </p>
              <GuideFigure
                src="/guides/getting-started/00-guided-first-run.png"
                alt="TheWCAG first-run screen offering a guided sample audit, blank audit, package import, and screenshot-only capture library, followed by Plan, Inspect, Review, and Deliver."
                title="Current first-run experience."
                priority
              > The demo takes about five minutes, is clearly labeled, and can be deleted in one action.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Install the desktop app.</strong><span>Use the Windows or macOS installer from the download page, then launch TheWCAG from the normal application shortcut.</span></li>
                <li><strong>Choose Guided sample audit.</strong><span>Use the demo when you want to learn the real controls without a network connection or client data. Choose Create blank audit when you are ready for real work.</span></li>
                <li><strong>Name real work precisely.</strong><span>Include the product and release, such as “Customer portal · July release”, so exports and follow-up audits remain understandable.</span></li>
                <li><strong>Add browser capture when useful.</strong><span>The <Link href="/chrome-accessibility-extension">Chrome extension</Link> is an optional faster entry point for live websites: select the affected component, describe the issue, then send it to the desktop review queue.</span></li>
              </ol>
              <aside className="guide-note"><strong>Only need screenshots?</strong><p>Choose Open screenshot-only capture library. You can capture, annotate, copy, and export without creating an audit or finding. The audit workflow does not block this standalone path.</p></aside>
              <aside className="guide-note"><strong>Privacy first</strong><p>Local audits, exports, packages, screenshots, and AI providers configured with your own key work without signing in. Hosted report links and TheWCAG-managed AI are explicit online services.</p></aside>
              <DoneWhen>The Guided sample audit or a clearly named real audit is open and the four audit stages are visible.</DoneWhen>
            </section>

            <section id="browser-extension" className="guide-section">
              <div className="guide-step-heading"><span>02</span><div><p>Optional website path</p><h2>Capture the issue where you find it</h2></div></div>
              <p>
                When you are testing a live website, the extension can shorten the trip from observation to finding. Keep the desktop app open, select the component or region in the page, write what happened, and approve the bounded evidence that will accompany the issue.
              </p>
              <ol className="guide-instructions">
                <li><strong>Connect the extension to the desktop app.</strong><span>Choose the local audit that should receive the issue. The extension uses the allowlisted local desktop connector; it does not send the screenshot or page context to a website API.</span></li>
                <li><strong>Select Component or Region.</strong><span>Component captures one control, text node, or image. Region captures several related elements. Both choices create a marked context screenshot.</span></li>
                <li><strong>Describe the observed behavior.</strong><span>Write the issue detail while the page is still in front of you. Add the task context when it helps another person reproduce the barrier.</span></li>
                <li><strong>Review what will be attached.</strong><span>Independently approve the screenshot, component name/role/selector data, and page title/address. You can withhold any of them before sending.</span></li>
                <li><strong>Send to desktop review.</strong><span>The desktop stores the evidence, prepares a bounded draft, and logs the finding as Needs review. No WCAG mapping, severity, status, or auditor decision is silently confirmed.</span></li>
                <li><strong>Finish the decision in Findings.</strong><span>Open the queued record, verify its actual and expected results, user impact, severity, WCAG mapping, and evidence, then save it as reviewed.</span></li>
              </ol>
              <aside className="guide-note"><strong>The normal process still works</strong><p>You can begin in Plan or Inspect, author the finding in the desktop editor, and choose Add evidence there. The extension is a faster website intake path, not a requirement and not a replacement for auditor review.</p></aside>
              <aside className="guide-note guide-note--warning"><strong>Signals are not decisions</strong><p>Captured checks and generated language are supporting information. A pending browser intake blocks a complete delivery record until an auditor opens and confirms it.</p></aside>
              <div className="guide-actions">
                <Link href="/chrome-accessibility-extension" className="button button--secondary">Set up the browser extension <ArrowRightIcon size={16} /></Link>
              </div>
              <DoneWhen>The browser issue appears in the selected desktop audit under Needs review with its approved screenshot and component context attached.</DoneWhen>
            </section>

            <section id="plan" className="guide-section">
              <div className="guide-step-heading"><span>03</span><div><p>Stage 1 of 4</p><h2>Build an audit-ready plan</h2></div></div>
              <p>
                Define the decision the audit must support before testing begins. The built-in scoper can propose representative coverage from a bounded public-page inspection, but you must confirm the template, sample, exclusions, and every conformance decision.
              </p>
              <GuideFigure
                src="/guides/getting-started/01-plan-your-audit.png"
                alt="TheWCAG Plan stage in a guided demo, showing the four audit stages, completed planning fields, a bundled local target, suggested product coverage, and audit status."
                title="Plan and scoper workspace."
              > The demo shows the current four-stage navigation and a complete local scope that is ready for inspection.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Describe the target.</strong><span>Use the exact production or test URL when available. For a desktop app or document set, enter a clear release description instead.</span></li>
                <li><strong>Confirm suggested coverage.</strong><span>Review authentication, transactions, forms, media, documents, and reusable components. Add anything public discovery cannot see.</span></li>
                <li><strong>Document evaluation context.</strong><span>Complete the goal, included and excluded scope, sampling rationale, environments, assistive technologies, methodology, and auditor.</span></li>
                <li><strong>Add exact sample locations.</strong><span>Every representative page, flow, component, document, and state needs a URL or an unambiguous in-product location.</span></li>
                <li><strong>Prepare guided test runs.</strong><span>Add the reusable scripts that match the planned tasks and content. Each performed step needs its own saved observation.</span></li>
                <li><strong>Review the coverage map.</strong><span>Use it to trace each sample through a test record, finding-owned evidence, findings, and mapped WCAG decisions. Coverage is traceability, not a pass result.</span></li>
              </ol>
              <GuideFigure
                src="/guides/getting-started/audit-coverage-map.png"
                alt="TheWCAG Audit Coverage Map showing one sample traced through a completed guided test, one linked evidence capture, one finding, and one mapped WCAG criterion."
                title="Audit Coverage Map."
              > Every column names the relationship it proves. Untested work and missing links remain visible instead of being hidden inside a score.</GuideFigure>
              <aside className="guide-note guide-note--warning"><strong>Do not skip authenticated or conditional states</strong><p>The public scoper cannot sign in, submit forms, reach permission-gated screens, or guarantee third-party coverage. Add these locations manually.</p></aside>
              <aside className="guide-note"><strong>Older packages remain safe</strong><p>Legacy captures that were not linked to a finding migrate into an unassigned captures bucket. They stay visible until you deliberately attach or remove them.</p></aside>
              <DoneWhen>All seven core planning fields are complete, every sample has an exact location, the required test runs exist, and Inspect is ready.</DoneWhen>
            </section>

            <section id="inspect" className="guide-section">
              <div className="guide-step-heading"><span>04</span><div><p>Stage 2 of 4</p><h2>Inspect and attach evidence in context</h2></div></div>
              <p>
                Test the rendered interface people actually receive. Run each manual script, record the observation, create a finding when you observe a barrier, and use Add evidence inside that finding so the capture returns to the record it supports.
              </p>
              <GuideFigure
                src="/guides/getting-started/02-inspect-and-measure.png"
                alt="TheWCAG Inspect stage with a demo coach mark, completed guided audit session, rendered contrast specimen, and four-stage audit navigation."
                title="Inspect and guided testing."
              > The sample includes dismissible keyboard-accessible coach marks for contrast, capture, and the vision lens. Reduced-motion preferences are respected.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Open the exact sample location.</strong><span>Exercise the successful path, error states, keyboard sequence, zoom and reflow conditions, and assistive-technology checks required by the script.</span></li>
                <li><strong>Record every performed step.</strong><span>Check a step only after testing it and save a concise observation. A run cannot be completed while a checked step lacks an observation.</span></li>
                <li><strong>Create the finding.</strong><span>Record observable actual behavior, expected behavior, user impact, severity rationale, location, and the criterion that requires manual review.</span></li>
                <li><strong>Choose Add evidence.</strong><span>Capture and annotate without leaving finding authoring. The saved image is linked immediately; repeat the action when the finding needs multiple views.</span></li>
                <li><strong>Use before and after evidence deliberately.</strong><span>Keep remediation comparisons on the same stable finding reference and record the environment used for the retest.</span></li>
              </ol>
              <GuideFigure
                src="/guides/getting-started/finding-owned-evidence.png"
                alt="TheWCAG finding editor with an Add evidence button, one attached primary capture, an Annotate action, and before and after remediation evidence selectors."
                title="Evidence attached to the finding."
              > A finding can hold multiple captures. Before and after evidence remain explicit rather than replacing the primary evidence list.</GuideFigure>
              <aside className="guide-note"><strong>Capture only is still available</strong><p>The guided session also offers Capture only. It saves an unassigned local image for later use. This is useful when you are not ready to write a finding, but it does not count as finding evidence until you attach it.</p></aside>
              <DoneWhen>Every performed test step has an observation, each barrier has a complete finding, and the finding shows the annotated evidence that supports it.</DoneWhen>
            </section>

            <section id="review" className="guide-section">
              <div className="guide-step-heading"><span>05</span><div><p>Stage 3 of 4</p><h2>Review decisions, remediation, and tickets</h2></div></div>
              <p>
                Review is where evidence becomes an auditor decision. Confirm each finding, work through all applicable WCAG 2.2 A and AA criteria, and keep unresolved or untested work explicit. Automated and deterministic results remain supporting signals.
              </p>
              <GuideFigure
                src="/guides/getting-started/04-review-findings.png"
                alt="TheWCAG Review stage showing accessible report format and audience controls, review metrics, a VPAT authoring scaffold with zero human responses, and WCAG checklist progress."
                title="Review, reporting, and VPAT authoring."
              > The VPAT scaffold begins with zero human responses even though the sample checklist is complete. Checklist signals never generate a conformance response.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Triage every finding.</strong><span>Confirm severity, affected users, WCAG mapping, owner, target date, repeated occurrences, remediation state, accepted risk, and retest history.</span></li>
                <li><strong>Record criterion decisions.</strong><span>Use Pass, Fail, or N/A only after the planned sample supports the choice. Keep unresolved criteria visibly untested.</span></li>
                <li><strong>Add decision notes.</strong><span>Explain important evidence, limitations, interpretation choices, and the relationship between failed criteria and findings.</span></li>
                <li><strong>Create a remediation ticket when needed.</strong><span>Choose Jira, Linear, or GitHub Issues. Review the mapped fields once, then create the ticket without retyping the finding.</span></li>
                <li><strong>Review external changes.</strong><span>Re-sync displays external status changes beside the local auditor decision. Conflicts wait for review and never silently overwrite the local status.</span></li>
              </ol>
              <GuideFigure
                src="/guides/getting-started/ticket-integrations.png"
                alt="TheWCAG finding editor showing severity, remediation status, owner, target date, evidence link, and a Create ticket panel with Jira and field mapping controls."
                title="Create ticket from the finding."
              > Credentials stay behind the desktop main-process IPC boundary. The renderer receives configuration state, not stored secrets.</GuideFigure>
              <DoneWhen>All applicable criteria are decided, every failure is traceable, included findings are complete, and external ticket changes have been reviewed.</DoneWhen>
            </section>

            <section id="deliver" className="guide-section">
              <div className="guide-step-heading"><span>06</span><div><p>Stage 4 of 4</p><h2>Deliver an accessible, bounded report</h2></div></div>
              <p>
                Deliver separates a focused evidence report from a complete audit. Resolve the readiness results, write the conclusion and limitations, choose the audience sections, and export or publish only what the reviewed record supports.
              </p>
              <GuideFigure
                src="/guides/getting-started/05-deliver-report.png"
                alt="TheWCAG Deliver stage showing focused-report readiness checks, a human-authored audit conclusion, and the four-stage navigation."
                title="Delivery readiness and conclusion."
              > Missing finding evidence and incomplete details remain visible even when the evaluation plan and criterion review are complete.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Read every readiness result.</strong><span>Resolve missing plan fields, incomplete samples or test runs, undecided criteria, unlinked failures, incomplete findings, and missing finding evidence.</span></li>
                <li><strong>Write the audit conclusion.</strong><span>Record the outcome, completion date, executive summary, and known limitations. Do not claim conformance beyond the completed scope.</span></li>
                <li><strong>Choose the report audience.</strong><span>Include or omit the executive summary, limitations, and prioritized action plan according to the readers&apos; needs.</span></li>
                <li><strong>Choose an accessible local format.</strong><span>Use branded accessible HTML, PDF, or portable Markdown. Headings, tables, link text, document language, title, and metadata are generated for the chosen report—not a conformance verdict.</span></li>
                <li><strong>Author VPAT responses yourself.</strong><span>Every criterion begins as Auditor response required. Only a human-entered response and remarks can appear as a conformance response.</span></li>
                <li><strong>Publish deliberately.</strong><span>Hosted links are unlisted by default. Recipients can filter and sort findings, use keyboard jump links, open annotated evidence in an accessible lightbox, and print a clean report.</span></li>
                <li><strong>Retain a portable audit package.</strong><span>Export an integrity-checked package when the complete audit, its stable finding references, and evidence relationships must move between computers.</span></li>
              </ol>
              <aside className="guide-note"><strong>What Pro changes</strong><p>Pro adds managed AI drafts, hosted links, view analytics, private hosted storage, and optional hosted branding. The local Plan, Inspect, Review, Deliver, screenshot, ticket, export, package, and program features remain local desktop capabilities.</p></aside>
              <DoneWhen>The report language matches the tested scope, every selected section is intentional, sensitive evidence has been reviewed, and no machine-generated conformance claim appears.</DoneWhen>
            </section>

            <section id="after-delivery" className="guide-section">
              <div className="guide-step-heading"><span>07</span><div><p>After the report</p><h2>Retest, preserve, and learn from owned data</h2></div></div>
              <p>
                Delivery is not the end of remediation. Keep the stable finding open through ready-for-retest and verified-fixed states, attach after evidence, and use owned local audit history to review operational patterns without turning them into a conformance score.
              </p>
              <ol className="guide-instructions">
                <li><strong>Retest in the recorded environment.</strong><span>Confirm the build, date, browser or app version, assistive technology, and outcome. Attach after evidence to the same finding.</span></li>
                <li><strong>Review program trends.</strong><span>Program shows observed recurrence, median ready-for-retest to verified time, component hotspots, and regression rate from owned local audits.</span></li>
                <li><strong>Keep the guardrails visible.</strong><span>Charts include data-table equivalents, do not use color alone, exclude the guided demo, and never present a pass rate or overall conformance score.</span></li>
                <li><strong>Import older packages safely.</strong><span>Finding relationships remain stable. Orphaned legacy captures move into the visible unassigned bucket instead of being lost.</span></li>
                <li><strong>Delete the demo when finished.</strong><span>Use Delete demo in the workstation header. It removes the clearly labeled sample in one action without affecting real audits.</span></li>
              </ol>
              <GuideFigure
                src="/guides/getting-started/standalone-capture-library.png"
                alt="TheWCAG standalone capture library with region and full-screen capture actions, a search field, and a recent local annotated capture."
                title="Standalone capture library."
              > Screenshot-only users can continue capturing, annotating, copying, and exporting without returning to an audit or creating a finding.</GuideFigure>
              <aside className="guide-note"><strong>Optional Findings &amp; captures view</strong><p>This utility reviews finding-owned evidence, capture-only work, and legacy unassigned images. It is not a fifth audit stage and does not block Deliver by itself.</p></aside>
              <DoneWhen>Retest decisions remain tied to their original findings, required packages are retained, and the demo has been deleted if it is no longer useful.</DoneWhen>
            </section>

            <section className="guide-next" aria-labelledby="guide-next-heading">
              <div><span>Ready for the real project?</span><h2 id="guide-next-heading">Start with the scope, then keep evidence with the finding.</h2><p>A defensible audit needs a representative sample, observable findings, explicit human decisions, and a report that states its limits.</p></div>
              <div className="guide-actions">
                <GuideDownloadLink className="button button--primary">Download the desktop app</GuideDownloadLink>
                <Link href="/accessibility-reporting-software" className="button button--secondary">Explore accessible reports</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
