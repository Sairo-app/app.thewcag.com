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
  title: "Accessibility Audit Software for Real Interface Evidence",
  description:
    "TheWCAG combines a macOS and Windows accessibility audit workstation, Chrome evidence capture, WCAG 2.2 planning, findings, retesting, and controlled reports.",
  path: "/",
  keywords: ["accessibility audit software", "WCAG audit tool", "accessibility testing app", "Chrome accessibility extension"],
});

const PRINCIPLES = [
  {
    title: "Plan the evaluation",
    body: "Define the goal, scope, representative sample, environments, assistive technologies, and methodology before decisions begin.",
  },
  {
    title: "Inspect and document",
    body: "Measure rendered interfaces, capture browser or desktop evidence, and keep every finding connected to its proof and WCAG decision.",
  },
  {
    title: "Retest and deliver",
    body: "Track remediation, compare before and after evidence, complete readiness checks, and export or publish only what you choose.",
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
    title: "Evidence that stays editable",
    body: "Capture a region and add issue markers, arrows, boxes, measurements, focus order, text, and redaction.",
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
    title: "Audit planning and delivery",
    body: "Define scope, run guided tests, verify checklist traceability, retest remediation, and produce a defensible audit record.",
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
  ["Inspect", "Use desktop instruments and guided scripts across the interface you need to evaluate."],
  ["Evidence", "Capture the exact state and connect each barrier to its context and the standard."],
  ["Review", "Triage findings, trace failed criteria, assign remediation, and record retest outcomes."],
  ["Deliver", "Run readiness checks, export the audit record, or publish only the report you choose."],
] as const;

export default function Home() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TheWCAG",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "macOS, Windows",
          url: SITE_URL,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: metadata.description,
          featureList: ["Audit planning", "Chrome evidence capture", "WCAG 2.2 checklist", "Annotated screenshots", "Findings and retesting", "Portable audit exports"],
        }}
      />

      <main id="main" className="home">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-shell home-hero__inner">
            <div className="home-hero__intro">
              <div className="home-hero__copy">
                <h1 id="home-heading">
                  <span>Find the barrier.</span>
                  <span>Keep the proof.</span>
                </h1>
              </div>
              <div className="home-hero__support">
                <p>
                  Inspect any rendered interface, capture the exact failure, and turn it into clear WCAG evidence from one local desktop workspace.
                </p>
                <div className="home-actions">
                  <Link href="/download" className="button button--primary">
                    Download free <ArrowRightIcon size={16} />
                  </Link>
                  <Link href="#workflow" className="button button--secondary">
                    See the workflow
                  </Link>
                </div>
              </div>
            </div>

            <div className="home-hero__stage">
              <AuditPlayground />
            </div>
          </div>
        </section>

        <aside className="home-proof" aria-label="Product facts">
          <div className="home-shell home-proof__inner">
            <span>Local-first captures</span>
            <span>Chrome evidence capture</span>
            <span>macOS and Windows</span>
            <span>WCAG 2.2 A and AA</span>
          </div>
        </aside>

        <section id="purpose" className="home-purpose" aria-labelledby="purpose-heading">
          <div className="home-shell">
            <div className="section-heading">
              <h2 id="purpose-heading">Accessibility happens in the rendered experience.</h2>
              <p>
                Automation can inspect code. TheWCAG gives human auditors the instruments to examine the interface people actually receive.
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
                    <span className="capability-map__icon" aria-hidden="true"><Icon size={22} /></span>
                    <span className="capability-map__copy">
                      <strong>{tool.title}</strong>
                      <span>{tool.body}</span>
                    </span>
                    <span className="capability-map__arrow" aria-hidden="true"><ArrowRightIcon size={17} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-connected" aria-labelledby="connected-heading">
          <div className="home-shell">
            <div className="section-heading section-heading--compact">
              <h2 id="connected-heading">Three surfaces, one clear responsibility each.</h2>
              <p>The browser captures the webpage, the desktop owns the audit, and the website handles services you explicitly request.</p>
            </div>
            <div className="home-connected__flow">
              <Link href="/chrome-accessibility-extension"><strong>Chrome extension</strong><span>Select a control or region and review contextual evidence.</span></Link>
              <span aria-hidden="true">→</span>
              <Link href="/accessibility-audit-software"><strong>Desktop workstation</strong><span>Store the audit locally, confirm findings, manage remediation, and retest.</span></Link>
              <span aria-hidden="true">→</span>
              <Link href="/download"><strong>Website service</strong><span>Sign in, request AI drafting, publish chosen reports, and download releases.</span></Link>
            </div>
          </div>
        </section>

        <section id="platforms" className="home-platforms" aria-labelledby="platforms-heading">
          <div className="home-shell">
            <div className="section-heading">
              <h2 id="platforms-heading">Built for the desktop you audit on.</h2>
              <p>One familiar workflow, adapted to each platform's shortcuts, permissions, windows, and display systems.</p>
            </div>

            <div className="platform-grid">
              <article className="platform-panel platform-panel--mac">
                <div className="platform-panel__icon"><AppleIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy">
                  <h3>macOS</h3>
                  <p>Universal Apple Silicon and Intel builds with menu-bar access and clear Screen Recording permission recovery.</p>
                  <ul>
                    <li><CheckIcon size={15} /> macOS 12 Monterey or later</li>
                    <li><CheckIcon size={15} /> Apple Silicon and Intel</li>
                    <li><CheckIcon size={15} /> <kbd>⌥⌘P</kbd> contrast picker</li>
                  </ul>
                </div>
                <a href="/api/desktop/download?os=mac" className="button button--dark">
                  Download for macOS <ArrowRightIcon size={16} />
                </a>
              </article>

              <article className="platform-panel platform-panel--windows">
                <div className="platform-panel__icon"><WindowsIcon className="h-8 w-8" /></div>
                <div className="platform-panel__copy">
                  <h3>Windows</h3>
                  <p>Windows-aware chrome, compact layouts, native shortcut labels, and sharp output across high-DPI displays.</p>
                  <ul>
                    <li><CheckIcon size={15} /> Windows 10 and 11, 64-bit</li>
                    <li><CheckIcon size={15} /> Multi-display and high-DPI ready</li>
                    <li><CheckIcon size={15} /> <kbd>Ctrl Alt P</kbd> contrast picker</li>
                  </ul>
                </div>
                <a href="/api/desktop/download?os=windows" className="button button--secondary">
                  Download for Windows <ArrowRightIcon size={16} />
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
              <h2 id="trust-heading">Your evidence stays yours.</h2>
              <p>The web layer supports the workflow without turning every capture into cloud data.</p>
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
