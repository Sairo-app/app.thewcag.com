import type { Metadata } from "next";
import Link from "next/link";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuditPlayground } from "@/components/HomeExperience";
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

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Audit what people see",
  description:
    "TheWCAG is a local-first accessibility auditing workspace for macOS and Windows. Inspect any interface, capture evidence, track WCAG 2.2 findings, and publish clear review links.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "TheWCAG - Audit what people see",
    description:
      "A local-first desktop accessibility workspace for finding, documenting, and sharing barriers across any interface.",
    url: SITE,
  },
};

const PRINCIPLES = [
  {
    title: "Inspect the experience",
    body: "Measure websites, native software, prototypes, documents, remote sessions, and temporary interface states exactly as they render.",
  },
  {
    title: "Document the barrier",
    body: "Keep the screenshot, annotation, measurement, WCAG criterion, severity, status, and auditor note connected.",
  },
  {
    title: "Hand off the proof",
    body: "Export the audit or publish a focused report that a client can open without creating an account.",
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
    title: "A connected findings register",
    body: "Search and filter issues without separating the finding from its visual state or audit context.",
    href: "/screenshot-tool",
  },
  {
    icon: BookIcon,
    title: "The full WCAG 2.2 audit",
    body: "Track every Level A and AA criterion with pass, fail, not applicable, notes, scope, and progress.",
    href: "/wcag-checklist",
  },
  {
    icon: PaletteIcon,
    title: "Palette-wide checks",
    body: "Compare up to sixteen colors and catch unsafe foreground and background pairings before release.",
    href: "/color-contrast-checker",
  },
] as const;

const SHARED_FEATURES = [
  { title: "Global remappable shortcuts", body: "Open each audit tool from anywhere on the desktop." },
  { title: "Light and dark appearance", body: "Follow the system while every control stays legible." },
  { title: "Keyboard-visible focus", body: "Move through the workspace with a clear focus indicator." },
  { title: "Reduced-motion support", body: "Keep context without unnecessary movement." },
  { title: "High-DPI capture", body: "Preserve sharp annotations on modern displays." },
  { title: "Signed automatic updates", body: "Install verified releases without disrupting an audit." },
] as const;

const WORKFLOW = [
  ["Inspect", "Use a global shortcut over the interface you need to evaluate."],
  ["Document", "Capture the exact state and connect the barrier to the standard."],
  ["Organize", "Keep findings, checklist status, scope, and evidence together."],
  ["Share", "Publish only what you choose, or export it in the format your team uses."],
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
          url: SITE,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "A local-first desktop accessibility workspace with contrast checking, vision simulation, annotated evidence, WCAG 2.2 audits, and shareable reports.",
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
            <span>Any rendered interface</span>
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
              <p>Each tool shares the same audit context, from the first inspection to the final handoff.</p>
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
              <article><h3>Device access</h3><p>Desktop sign-in uses your system browser and a secure app deep link. Raw device tokens are never stored in the database.</p></article>
              <article><h3>Published reports</h3><p>Unlisted links contain only the image, findings, and branding you choose. Viewers do not need an account.</p></article>
              <article><h3>Account controls</h3><p>Passwordless sign-in, a private report library, deletion controls, and optional client-facing branding stay in your hands.</p></article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
