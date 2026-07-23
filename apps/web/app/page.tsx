import type { Metadata } from "next";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuditPlayground } from "@/components/HomeExperience";
import { createPageMetadata, SITE_URL } from "@/lib/seo";
import {
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ContrastIcon,
  CropIcon,
  EyeIcon,
  ImageIcon,
  PaletteIcon,
  WindowsIcon,
} from "@/components/icons";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Audit Software for the Rendered Experience",
  description:
    "TheWCAG combines local WCAG 2.2 audits, standalone screenshot capture, finding-owned evidence, remediation tickets, accessible reports, retesting, and program trends on macOS and Windows.",
  path: "/",
  keywords: ["accessibility audit software", "WCAG audit tool", "accessibility testing app", "Chrome accessibility extension"],
});

const PRINCIPLES = [
  {
    title: "Find what scanners miss",
    body: "Inspect the rendered interface across browsers and desktop apps, including temporary states that never appear in a source-code report.",
  },
  {
    title: "Keep the proof attached",
    body: "Capture visual and semantic context with the issue so reviewers can see the barrier, reproduce it, and understand the WCAG decision.",
  },
  {
    title: "Deliver a defensible record",
    body: "Review severity, ownership, remediation, WCAG mapping, and retest history before you export or publish anything.",
  },
] as const;

const CAPABILITIES = [
  {
    icon: ContrastIcon,
    title: "Contrast from any pixel",
    body: "Check WCAG AA, AAA, and APCA across websites, desktop apps, prototypes, documents, and video.",
    href: "/color-contrast-checker",
  },
  {
    icon: CropIcon,
    title: "Standalone screenshot tool",
    body: "Capture, annotate, copy, export, or share a screenshot without creating an audit or changing your existing workflow.",
    href: "/screenshot-tool",
  },
  {
    icon: EyeIcon,
    title: "Live vision simulation",
    body: "Move a lens over any application to test color-vision deficiencies, low acuity, and reduced contrast.",
    href: "/color-blindness-simulator",
  },
  {
    icon: ImageIcon,
    title: "Browser evidence to audit",
    body: "Mark a webpage control, capture contextual visual and semantic evidence, review an AI-assisted draft, and save it locally.",
    href: "/chrome-accessibility-extension",
  },
  {
    icon: BookIcon,
    title: "The full WCAG 2.2 audit",
    body: "Track every Level A and AA criterion with pass, fail, not applicable, notes, scope, and progress.",
    href: "/wcag-checklist",
  },
  {
    icon: PaletteIcon,
    title: "Accessible reports and VPAT authoring",
    body: "Create audience-specific HTML or PDF reports and author every VPAT response explicitly—never from an automated signal.",
    href: "/accessibility-reporting-software",
  },
  {
    icon: CheckIcon,
    title: "Tickets without retyping",
    body: "Map complete findings into Jira, Linear, or GitHub Issues and review external changes before they affect local audit decisions.",
    href: "/accessibility-issue-tracker-integrations",
  },
  {
    icon: BookIcon,
    title: "Program trends without a score",
    body: "Review recurrence, retest time, component hotspots, and regressions from owned audit history while untested work stays visible.",
    href: "/accessibility-program-management",
  },
  {
    icon: PaletteIcon,
    title: "Audit planning and delivery",
    body: "Define scope, run guided tests, verify finding-to-evidence traceability, retest remediation, and produce a defensible audit record.",
    href: "/accessibility-audit-software",
  },
] as const;

const SHARED_FEATURES = [
  { title: "Global remappable shortcuts", body: "Open each audit tool from anywhere on the desktop." },
  { title: "Calibrated light interface", body: "Keep dense audit work readable without visual noise." },
  { title: "Keyboard-visible focus", body: "Move through the workspace with a clear focus indicator." },
  { title: "Reduced-motion support", body: "Keep context without unnecessary movement." },
  { title: "High-DPI capture", body: "Preserve sharp annotations on modern displays." },
  { title: "Integrity-checked updates", body: "Use signed and notarized macOS releases plus versioned update metadata." },
] as const;

const WORKFLOW = [
  ["Plan", "Define scope, representative samples, environments, assistive technologies, and the evaluation method."],
  ["Inspect", "Use guided scripts and desktop instruments, then capture and annotate evidence directly inside each finding."],
  ["Review", "Triage findings, trace failed criteria, assign remediation, and record retest outcomes."],
  ["Deliver", "Run readiness checks, create accessible audience-specific reports, or publish only the evidence you choose."],
] as const;

export default function Home() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "TheWCAG",
              alternateName: "The WCAG",
              url: SITE_URL,
            },
            {
              "@type": "SoftwareApplication",
              name: "TheWCAG",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Windows",
              url: SITE_URL,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              description: metadata.description,
              featureList: ["Audit planning", "Finding-owned evidence", "WCAG 2.2 checklist", "Jira, Linear, and GitHub Issues", "Accessible reports and VPAT authoring", "Retesting and program trends"],
            },
          ],
        }}
      />

      <main id="main" className="home">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-shell home-hero__inner">
            <div className="home-hero__intro">
              <div className="home-hero__copy">
                <p className="home-hero__eyebrow">Local-first accessibility audit software</p>
                <h1 id="home-heading">
                  <span>Audit what</span>
                  <span>people see.</span>
                </h1>
                <p className="home-hero__lead">
                  Find barriers automation misses. Capture the rendered experience, turn evidence into review-ready WCAG findings, and deliver a report from one focused workspace.
                </p>
                <div className="home-actions">
                  <Link href="/download" className="button button--primary">
                    Download free <ArrowRightIcon size={16} />
                  </Link>
                  <Link href="#workflow" className="button button--secondary">
                    See how it works
                  </Link>
                </div>
                <div className="home-hero__assurances" aria-label="Download details">
                  <span><CheckIcon size={16} /> No account to start</span>
                  <span><CheckIcon size={16} /> macOS and Windows</span>
                  <span><CheckIcon size={16} /> Local by default</span>
                </div>
              </div>

              <div className="home-hero__stage">
                <AuditPlayground />
              </div>
            </div>
          </div>
        </section>

        <aside className="home-proof" aria-label="Product facts">
          <div className="home-shell home-proof__inner">
            <span><CheckIcon size={16} /> Free desktop app</span>
            <span><CheckIcon size={16} /> Works without an account</span>
            <span><CheckIcon size={16} /> Evidence stays on your device</span>
            <span><CheckIcon size={16} /> WCAG 2.2 audit workflow</span>
          </div>
        </aside>

        <section className="home-paths" aria-labelledby="home-paths-heading">
          <div className="home-shell home-paths__inner">
            <div className="home-paths__intro">
              <span>Choose your starting point</span>
              <h2 id="home-paths-heading">What do you need today?</h2>
            </div>
            <Link href="/getting-started" className="home-paths__link">
              <strong>Run your first audit</strong>
              <span>Follow the guided sample and four-stage workflow.</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link href="/download" className="home-paths__link">
              <strong>Start working locally</strong>
              <span>Download the free desktop workstation for macOS or Windows.</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link href="/pricing" className="home-paths__link">
              <strong>Add hosted services</strong>
              <span>Compare managed AI, hosted reports, analytics, and branding.</span>
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </section>

        <section id="purpose" className="home-purpose" aria-labelledby="purpose-heading">
          <div className="home-shell">
            <div className="section-heading">
              <h2 id="purpose-heading">A source-code report is not the user experience.</h2>
              <p>
                TheWCAG gives human auditors the instruments and evidence trail to evaluate the interface people actually receive.
              </p>
            </div>
            <div className="home-purpose__principles">
              {PRINCIPLES.map((principle, index) => (
                <article key={principle.title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{principle.title}</h3>
                    <p>{principle.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tools" className="home-tools" aria-labelledby="tools-heading">
          <div className="home-shell">
            <div className="section-heading section-heading--compact">
              <h2 id="tools-heading">One workspace for the full evidence trail.</h2>
              <p>Desktop instruments, browser evidence, and audit records share one workflow from planning to delivery.</p>
            </div>
            <div className="capability-map">
              {CAPABILITIES.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.title} href={tool.href} className="capability-map__item">
                    <span className="capability-map__number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="capability-map__icon" aria-hidden="true"><Icon size={20} /></span>
                    <span className="capability-map__copy">
                      <strong>{tool.title}</strong>
                      <span>{tool.body}</span>
                    </span>
                    <span className="capability-map__arrow" aria-hidden="true"><ArrowRightIcon size={16} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-connected" aria-labelledby="connected-heading">
          <div className="home-shell">
            <div className="section-heading section-heading--compact">
              <h2 id="connected-heading">Keep the context from capture to handoff.</h2>
              <p>Move a real barrier through one continuous workflow instead of rebuilding the evidence in documents and ticket fields.</p>
            </div>
            <div className="home-connected__flow">
              <Link href="/chrome-accessibility-extension"><strong>Capture the barrier</strong><span>Select a webpage control or region with its visual and semantic context intact.</span></Link>
              <ArrowRightIcon size={16} />
              <Link href="/accessibility-audit-software"><strong>Confirm the finding</strong><span>Review the evidence, WCAG decision, severity, ownership, and remediation locally.</span></Link>
              <ArrowRightIcon size={16} />
              <Link href="/download"><strong>Deliver with control</strong><span>Export a portable audit or publish only the approved report you choose.</span></Link>
            </div>
          </div>
        </section>

        <section id="platforms" className="home-platforms" aria-labelledby="platforms-heading">
          <div className="home-shell">
            <div className="section-heading">
              <h2 id="platforms-heading">Choose your desktop. Keep the audit on it.</h2>
              <p>Start free on macOS or Windows. Your local audit does not require an account.</p>
            </div>

            <div className="platform-grid">
              <article className="platform-panel platform-panel--mac">
                <div className="platform-panel__icon"><AppleIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy">
                  <h3>macOS</h3>
                  <p>Universal Apple Silicon and Intel builds with menu-bar access and clear Screen Recording permission recovery.</p>
                  <ul>
                    <li><CheckIcon size={16} /> macOS 12 Monterey or later</li>
                    <li><CheckIcon size={16} /> Apple Silicon and Intel</li>
                    <li><CheckIcon size={16} /> <kbd>⌥⌘P</kbd> contrast picker</li>
                  </ul>
                </div>
                <a href="/api/desktop/download?os=mac" className="button button--dark">
                  Download free for macOS <ArrowRightIcon size={16} />
                </a>
              </article>

              <article className="platform-panel platform-panel--windows">
                <div className="platform-panel__icon"><WindowsIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy">
                  <h3>Windows</h3>
                  <p>Windows-aware chrome, compact layouts, native shortcut labels, and sharp output across high-DPI displays.</p>
                  <ul>
                    <li><CheckIcon size={16} /> Windows 10 and 11, 64-bit</li>
                    <li><CheckIcon size={16} /> Multi-display and high-DPI ready</li>
                    <li><CheckIcon size={16} /> <kbd>Ctrl Alt P</kbd> contrast picker</li>
                  </ul>
                </div>
                <a href="/api/desktop/download?os=windows" className="button button--secondary">
                  Download free for Windows <ArrowRightIcon size={16} />
                </a>
              </article>
            </div>

            <ul className="feature-matrix" aria-label="Features shared across macOS and Windows">
              {SHARED_FEATURES.map((feature, index) => (
                <li key={feature.title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{feature.title}</strong>
                  <p>{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="workflow" className="home-workflow" aria-labelledby="workflow-heading">
          <div className="home-shell home-workflow__grid">
            <div className="section-heading section-heading--sticky">
              <h2 id="workflow-heading">Local while you work. Shareable when you decide.</h2>
              <p>Captures remain on your device until you explicitly publish a report or export a file.</p>
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

        <section className="home-trust" aria-labelledby="trust-heading">
          <div className="home-shell home-trust__inner">
            <div>
              <h2 id="trust-heading">Local-first is a product decision.</h2>
              <p>Audit work stays on your computer until you explicitly choose a connected service.</p>
            </div>
            <div className="home-trust__details">
              <article><h3>Local bridge</h3><p>The Chrome extension talks directly to an allowlisted desktop native host. The website is not placed inside that local connection.</p></article>
              <article><h3>Device access</h3><p>Desktop sign-in uses your system browser and a one-time state-bound app link. The account token is encrypted by the operating system and only its hash is stored by the service.</p></article>
              <article><h3>Published reports</h3><p>Unlisted links contain only the image, findings, and branding you choose. Viewers do not need an account.</p></article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
