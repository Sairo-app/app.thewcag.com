import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ArrowRightIcon, CheckIcon, DownloadIcon } from "@/components/icons";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Getting Started with TheWCAG: Your First Audit",
  description:
    "Follow the complete TheWCAG first-time guide with current desktop application screenshots, from scoping and guided testing through evidence, WCAG review, and delivery.",
  path: "/getting-started",
  keywords: [
    "TheWCAG getting started",
    "accessibility audit tutorial",
    "WCAG audit workflow",
    "accessibility testing guide",
    "first accessibility audit",
  ],
});

const GUIDE_STEPS = [
  { id: "install", label: "Install and open" },
  { id: "plan", label: "Plan the audit" },
  { id: "inspect", label: "Inspect barriers" },
  { id: "evidence", label: "Capture evidence" },
  { id: "review", label: "Review WCAG" },
  { id: "deliver", label: "Deliver safely" },
] as const;

const howToSteps = [
  ["Install and open TheWCAG", "Download the desktop application, launch it, and create a named local audit."],
  ["Plan the evaluation", "Confirm the suggested audit template, document the methodology, add exact sample locations, and review their coverage."],
  ["Inspect the rendered interface", "Run each guided manual test against its assigned sample, save an observation for every step, and measure rendered contrast where relevant."],
  ["Capture supporting evidence", "Capture and annotate the affected region, redact sensitive details, and link the evidence to its sample, test run, and finding."],
  ["Review findings and WCAG decisions", "Confirm finding details and record supported pass, fail, or not-applicable decisions for every applicable criterion."],
  ["Export or publish the report", "Complete the readiness checks, write a bounded conclusion, and export locally or explicitly publish only reviewed content."],
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
          width={1280}
          height={800}
          sizes="(max-width: 64rem) calc(100vw - 2rem), 900px"
          priority={priority}
        />
      </div>
      <figcaption>
        <p><strong>{title}</strong>{children}</p>
        <a href={src} target="_blank" rel="noreferrer">Open full-size screenshot <ArrowRightIcon size={14} /></a>
      </figcaption>
    </figure>
  );
}

function DoneWhen({ children }: { children: ReactNode }) {
  return (
    <div className="guide-done">
      <CheckIcon size={18} />
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
          <span className="guide-eyebrow">First-time guide · about 20 minutes to read and set up</span>
          <h1 id="guide-title">Run your first audit with confidence.</h1>
          <p>
            This guide follows the real TheWCAG desktop application from a blank audit to a reviewable report. Every screenshot below was captured from the current Windows build using a safe example project. The evaluation itself takes as long as its agreed scope requires.
          </p>
          <div className="guide-actions">
            <Link href="/download" className="button button--primary"><DownloadIcon size={17} />Download TheWCAG</Link>
            <a href="#install" className="button button--secondary">Start the guide <ArrowRightIcon size={16} /></a>
          </div>
          <dl className="guide-facts" aria-label="Guide facts">
            <div><dt>Account</dt><dd>Not required for local audits</dd></div>
            <div><dt>Platforms</dt><dd>Windows and macOS</dd></div>
            <div><dt>Outcome</dt><dd>A traceable, exportable audit record</dd></div>
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
              <div className="guide-step-heading"><span>01</span><div><p>Before the audit</p><h2>Install, open, and name the work</h2></div></div>
              <p>
                Download the correct installer, open TheWCAG, and use the project switcher in the upper-left corner to create a clearly named audit. The audit plan, captures, findings, and checklist stay on this computer unless you deliberately export or publish them.
              </p>
              <ol className="guide-instructions">
                <li><strong>Install the desktop app.</strong><span>Use the Windows or macOS installer from the download page, then launch TheWCAG from the normal application shortcut.</span></li>
                <li><strong>Create a useful project name.</strong><span>Choose a name that identifies the product and release, such as “Customer portal · July release”.</span></li>
                <li><strong>Decide whether you need browser capture.</strong><span>The Chrome extension is optional. Add it when you want semantic webpage context alongside the visual screenshot.</span></li>
              </ol>
              <aside className="guide-note"><strong>Privacy first</strong><p>You can complete a local audit, export it, and use an AI provider with your own key without signing in. A Pro subscription is needed only for TheWCAG managed AI and hosted report services.</p></aside>
              <DoneWhen>The project name identifies the work and the Plan stage is visible.</DoneWhen>
            </section>

            <section id="plan" className="guide-section">
              <div className="guide-step-heading"><span>02</span><div><p>Stage 1</p><h2>Build an audit-ready plan</h2></div></div>
              <p>
                Start with the built-in scoper. Enter a public URL or describe the application, confirm the suggested audit template and feature areas, then review every recommendation. Discovery only proposes coverage—it never makes a conformance decision.
              </p>
              <GuideFigure
                src="/guides/getting-started/01-plan-your-audit.png"
                alt="TheWCAG Plan stage showing the built-in scoper, product type, feature coverage, repeatable audit templates, and audit status panel."
                title="Plan and scoper workspace."
                priority
              > The left rail shows the five audit stages, the centre contains the editable plan, and the right panel summarizes readiness and privacy status.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Describe the target.</strong><span>Use the exact production or test URL when available. For a desktop app or document set, enter a clear release description instead.</span></li>
                <li><strong>Confirm the detected template.</strong><span>Review the grouped page templates, feature signals, explanation, and confidence behind the suggestion. Select a different template when the evidence does not match the product.</span></li>
                <li><strong>Confirm the suggested coverage.</strong><span>Review authentication, transactions, forms, media, documents, and reusable components. Add anything that public discovery cannot see.</span></li>
                <li><strong>Document evaluation context.</strong><span>Complete the goal, scope, exclusions, environments, assistive technologies, methodology, and sampling rationale.</span></li>
                <li><strong>Add exact sample locations.</strong><span>Every representative page, flow, component, document, and state needs a URL or unambiguous in-product location.</span></li>
                <li><strong>Review the coverage map.</strong><span>Use the read-only map to spot samples without a linked test run, evidence, finding, or mapped WCAG criterion, then continue the relevant sample in Inspect.</span></li>
              </ol>
              <GuideFigure
                src="/guides/getting-started/audit-coverage-map.png"
                alt="TheWCAG Audit Coverage Map showing planned samples, guided test progress, contextual evidence and findings, WCAG mappings, gaps, and Continue actions."
                title="Audit Coverage Map."
              > Each row traces one planned sample through testing, evidence, findings, and WCAG mappings. Covered means records are linked; it does not mean the sample conforms.</GuideFigure>
              <aside className="guide-note guide-note--warning"><strong>Do not skip authenticated or conditional states</strong><p>The public scoper cannot sign in, submit forms, reach permission-gated screens, or guarantee coverage of third-party surfaces. Add these manually.</p></aside>
              <aside className="guide-note"><strong>Keep legacy work visible</strong><p>Evidence or findings created outside a guided session remain in an unassigned group until you link them. This prevents older work from disappearing or being counted against the wrong sample.</p></aside>
              <DoneWhen>Plan shows 7/7 core fields, every sample has an exact location, the proposed coverage is approved, and Inspect changes from “Setup needed” to “Ready”.</DoneWhen>
            </section>

            <section id="inspect" className="guide-section">
              <div className="guide-step-heading"><span>03</span><div><p>Stage 2</p><h2>Inspect the rendered experience</h2></div></div>
              <p>
                Test the interface people actually receive. The Inspect stage combines guided manual test runs with contrast measurement so every observation, capture, and finding can remain tied to the agreed sample and methodology.
              </p>
              <GuideFigure
                src="/guides/getting-started/guided-audit-session.png"
                alt="TheWCAG Guided Audit Session showing sample and test-run selectors, an exact location, step progress, a saved observation, contextual evidence and finding actions, and the inspector."
                title="Guided Audit Session."
              > Start next test selects an available sample and test script. The sample and run remain editable, and each checked step requires its own saved observation.</GuideFigure>
              <GuideFigure
                src="/guides/getting-started/02-inspect-and-measure.png"
                alt="TheWCAG Inspect stage showing foreground and background color values, a live specimen, WCAG contrast results, APCA output, and evidence actions."
                title="Contrast inspection workspace."
              > Sample the rendered foreground and background, choose the tested content type, and use the displayed result as one piece of evidence—not as an automatic conformance decision.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Open the exact sample location.</strong><span>Use the selector or URL saved in Plan, then exercise the successful path, error states, keyboard sequence, zoom/reflow conditions, and assistive-technology checks required by the script.</span></li>
                <li><strong>Start or resume the guided session.</strong><span>Use Start next test to pair an available sample with an unassigned run, or choose an existing pair. The run stays bound to that sample so work is not silently reassigned.</span></li>
                <li><strong>Record every tested step.</strong><span>Check a step only after performing it and save a concise observation beside it. A run cannot be completed while any checked step lacks an observation.</span></li>
                <li><strong>Measure the rendered colors.</strong><span>Pick foreground and background pixels from any application and select normal text, large text, or UI component according to what you tested.</span></li>
                <li><strong>Record the result in context.</strong><span>Capture evidence or create an editable finding from the session. The new record inherits the current sample and run links; confirm the observed barrier and applicable requirement before saving a failure.</span></li>
              </ol>
              <DoneWhen>Every performed step has a saved observation, the run is complete, and any barrier has linked evidence and a review-ready finding—or the no-barrier result is clearly documented.</DoneWhen>
            </section>

            <section id="evidence" className="guide-section">
              <div className="guide-step-heading"><span>04</span><div><p>Stage 3</p><h2>Capture evidence that explains the barrier</h2></div></div>
              <p>
                Capture only the area needed to understand the issue. Region capture usually produces clearer evidence; full-screen capture is useful when surrounding context or application state matters. Starting capture from a guided session automatically carries the current sample and test-run context into the saved record.
              </p>
              <GuideFigure
                src="/guides/getting-started/03-capture-evidence.png"
                alt="TheWCAG Evidence stage with Select region and Full screen capture actions, capture and finding tabs, search, and the audit status panel."
                title="Evidence library before the first capture."
              > New screenshots enter this local library and open in the annotation workspace. Standalone captures stay visible as unassigned until you deliberately link them.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Choose region or full screen.</strong><span>Prefer the smallest area that still shows the affected control, its state, and enough surrounding context to reproduce the problem.</span></li>
                <li><strong>Annotate the important detail.</strong><span>Use issue markers, arrows, boxes, measurements, focus-order labels, text, crop, and redaction where they improve understanding.</span></li>
                <li><strong>Remove sensitive information.</strong><span>Redaction is baked into exported or published imagery. Review names, email addresses, tokens, payment information, and private content first.</span></li>
                <li><strong>Verify its audit context.</strong><span>Confirm the planned sample and guided test run shown on the capture. If capture started outside a session, link it deliberately instead of assuming where it belongs.</span></li>
                <li><strong>Connect evidence to a finding.</strong><span>Give the issue a reproducible title, location, expected behavior, actual behavior, user impact, severity rationale, and WCAG mapping.</span></li>
              </ol>
              <DoneWhen>A reviewer can understand and reproduce the barrier without guessing what the screenshot is meant to show.</DoneWhen>
            </section>

            <section id="review" className="guide-section">
              <div className="guide-step-heading"><span>05</span><div><p>Stage 4</p><h2>Review findings and every applicable criterion</h2></div></div>
              <p>
                Review is where evidence becomes an audit decision. Work through the WCAG 2.2 A and AA checklist, confirm finding completeness, and distinguish failures from not-applicable criteria and untested work. The Coverage Map helps verify traceability, but it never replaces the criterion decision.
              </p>
              <GuideFigure
                src="/guides/getting-started/04-review-findings.png"
                alt="TheWCAG Review stage showing audit export controls, the review summary, WCAG 2.2 progress, filters, keyboard shortcuts, and criterion decision rows."
                title="WCAG review and checklist workspace."
              > Each applicable criterion receives a pass, fail, or not-applicable decision, with notes and traceability where the record needs explanation.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Triage every finding.</strong><span>Confirm severity, affected users, requirement mapping, ownership, duplicate occurrences, remediation state, and retest history.</span></li>
                <li><strong>Record criterion decisions.</strong><span>Use Pass, Fail, or N/A only after the planned sample supports the decision. Leave unresolved work visibly untested; a “covered” map row does not imply a pass.</span></li>
                <li><strong>Add concise decision notes.</strong><span>Explain important evidence, limitations, interpretation choices, and the relationship between failed criteria and findings.</span></li>
                <li><strong>Recheck traceability.</strong><span>Return to the Coverage Map to confirm findings and mapped WCAG criteria appear under the sample they actually affect.</span></li>
                <li><strong>Export a working record when needed.</strong><span>Printable HTML and portable Markdown provide reviewable local snapshots before any public report is created.</span></li>
              </ol>
              <DoneWhen>All applicable criteria are decided, failed criteria are traceable, and every included finding has complete audit details.</DoneWhen>
            </section>

            <section id="deliver" className="guide-section">
              <div className="guide-step-heading"><span>06</span><div><p>Stage 5</p><h2>Deliver only what the evidence supports</h2></div></div>
              <p>
                The delivery screen separates a focused evidence report from a complete audit. Use its readiness checks to avoid overstating coverage, then write the conclusion and choose a local export or an intentional hosted report.
              </p>
              <GuideFigure
                src="/guides/getting-started/05-deliver-report.png"
                alt="TheWCAG Deliver stage showing focused-report readiness, complete-audit checks, audit conclusion fields, report draft controls, and the report preview panel."
                title="Delivery readiness and report draft."
              > The screen explains exactly what is missing before publication and keeps the working audit private until you choose to share it.</GuideFigure>
              <ol className="guide-instructions">
                <li><strong>Read every readiness result.</strong><span>Resolve missing plan fields, incomplete sample testing, unfinished guided runs, undecided criteria, unlinked failures, and incomplete finding details.</span></li>
                <li><strong>Write the audit conclusion.</strong><span>Record the outcome, completion date, executive summary, and known limitations. Do not claim conformance beyond the evidence.</span></li>
                <li><strong>Choose local export or publishing.</strong><span>Local exports stay free and do not require an account. Hosted report links require a signed-in Pro account and include only the reviewed findings and evidence you explicitly select.</span></li>
                <li><strong>Retain the portable audit package.</strong><span>Export a package when you need an integrity-checked copy that can move between computers or support later remediation work. The package preserves sample, test-run, capture, finding, and WCAG links.</span></li>
              </ol>
              <aside className="guide-note"><strong>What Pro changes</strong><p>Pro adds managed AI drafts, hosted links, view analytics, private hosted storage, and optional hosted branding. It does not unlock or restrict scoping, guided testing, coverage, evidence, findings, review, retesting, or local export.</p></aside>
              <DoneWhen>The report language matches the completed scope, sensitive information has been reviewed, and the selected delivery method is intentional.</DoneWhen>
            </section>

            <section className="guide-next" aria-labelledby="guide-next-heading">
              <div><span>Ready for the real project?</span><h2 id="guide-next-heading">Start with the scope, not the screenshot.</h2><p>A defensible audit begins with a clear goal and representative sample. The evidence tools become useful once everyone agrees what is being evaluated.</p></div>
              <div className="guide-actions">
                <Link href="/download" className="button button--primary">Download the desktop app</Link>
                <Link href="/chrome-accessibility-extension" className="button button--secondary">Add browser capture</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
