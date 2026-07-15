import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuditPlayground, HomeMotion } from "@/components/HomeExperience";
import {
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ContrastIcon,
  CropIcon,
  EyeIcon,
  FlagIcon,
  PaletteIcon,
  WindowsIcon,
} from "@/components/icons";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Desktop accessibility auditing toolkit for macOS & Windows",
  description:
    "Audit accessibility anywhere on screen with WCAG contrast checks, color-blindness simulation, annotated findings, a WCAG 2.2 checklist, and shareable reports.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "TheWCAG - Accessibility auditing, anywhere on screen",
    description:
      "A local-first desktop toolkit for accessibility auditors, designers, developers, and QA teams on macOS and Windows.",
    url: SITE,
  },
};

const TOOLS: {
  icon: ReactNode;
  label: string;
  title: string;
  body: string;
  href: string;
  link: string;
  tone: string;
}[] = [
  {
    icon: <ContrastIcon size={22} />,
    label: "Measure",
    title: "Contrast from any pixel",
    body: "Sample foreground and background colors from websites, native apps, prototypes, documents, or video. Compare WCAG 2.2 and APCA in context.",
    href: "/color-contrast-checker",
    link: "Explore contrast",
    tone: "orange",
  },
  {
    icon: <CropIcon size={22} />,
    label: "Capture",
    title: "Evidence people can review",
    body: "Capture the failure state, annotate the issue, redact sensitive detail, assign severity, and attach the exact success criterion.",
    href: "/screenshot-tool",
    link: "See screenshot evidence",
    tone: "cream",
  },
  {
    icon: <EyeIcon size={22} />,
    label: "Simulate",
    title: "Vision changes, live",
    body: "Move a resizable lens through color-vision deficiencies, monochromacy, low acuity, and reduced contrast without leaving the interface.",
    href: "/color-blindness-simulator",
    link: "Try the simulator",
    tone: "green",
  },
  {
    icon: <FlagIcon size={22} />,
    label: "Triage",
    title: "A finding register that stays useful",
    body: "Search, filter, prioritize, and update findings while keeping the auditor note, evidence, status, and criterion together.",
    href: "/screenshot-tool",
    link: "Review the workflow",
    tone: "blue",
  },
  {
    icon: <BookIcon size={22} />,
    label: "Track",
    title: "The whole WCAG 2.2 audit",
    body: "Work every Level A and AA criterion with pass, fail, not applicable, notes, progress, and exports scoped to the audit.",
    href: "/wcag-checklist",
    link: "Open the checklist",
    tone: "purple",
  },
  {
    icon: <PaletteIcon size={22} />,
    label: "Stress-test",
    title: "Every palette pairing at once",
    body: "Turn a token set into a contrast matrix and find unsafe combinations before they become components or production defects.",
    href: "/color-contrast-checker",
    link: "Test a palette",
    tone: "yellow",
  },
];

const WORKFLOW = [
  ["01", "Frame the audit", "Record target, scope, evaluator, conformance level, and project context once."],
  ["02", "Inspect anywhere", "Use global shortcuts over websites, desktop apps, designs, documents, and transient states."],
  ["03", "Keep the proof", "Connect each observation to a capture, severity, criterion, status, and auditor note."],
  ["04", "Hand it off", "Export CSV, Markdown, HTML, or a focused review link without rebuilding the finding."],
];

const PLATFORM_FEATURES = [
  "Global remappable shortcuts",
  "Responsive narrow-window mode",
  "Automatic light and dark themes",
  "Keyboard-visible focus states",
  "Reduced-motion support",
  "Signed automatic updates",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lab-eyebrow"><span aria-hidden="true">✦</span>{children}</p>;
}

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
            "A desktop accessibility auditing toolkit with WCAG contrast checking, vision simulation, annotated findings, checklists, and shareable reports.",
        }}
      />

      <main id="main" className="lab-home">
        <HomeMotion />

        <div className="lab-notice">
          <div className="lab-shell">
            <span><i /> The desktop auditor toolkit</span>
            <Link href="/download">Now available for macOS + Windows <ArrowRightIcon size={14} /></Link>
          </div>
        </div>

        <section className="lab-hero" aria-labelledby="home-heading">
          <div className="lab-shell lab-hero__layout">
            <div className="lab-hero__copy" data-reveal>
              <Eyebrow>Built for human accessibility audits</Eyebrow>
              <h1 id="home-heading">
                Find the issue.<br />
                <span>Keep the proof.</span>
              </h1>
              <p className="lab-hero__lede">
                TheWCAG is the practical desktop lab for the accessibility work browser automation cannot see—native apps, prototypes, focus states, video, documents, and everything else on screen.
              </p>
              <div className="lab-actions">
                <Link href="/download" className="lab-button lab-button--primary">
                  Download free <ArrowRightIcon size={17} />
                </Link>
                <Link href="/screenshot-tool" className="lab-button">
                  Explore the toolkit
                </Link>
              </div>
              <ul className="lab-hero__promises" aria-label="Product promises">
                <li><CheckIcon size={15} /> Local-first</li>
                <li><CheckIcon size={15} /> No account to start</li>
                <li><CheckIcon size={15} /> WCAG 2.2 ready</li>
              </ul>
            </div>

            <div className="lab-hero__playground" data-reveal style={{ "--reveal-delay": "120ms" } as CSSProperties}>
              <div className="lab-doodle lab-doodle--note" aria-hidden="true">try it →</div>
              <AuditPlayground />
              <div className="lab-sticker" aria-hidden="true"><strong>6</strong><span>tools<br />one audit</span></div>
            </div>
          </div>
        </section>

        <section className="lab-proof" aria-label="Product specifications">
          <div className="lab-shell lab-proof__grid">
            <div><strong>6</strong><span>Connected auditor tools</span></div>
            <div><strong>2</strong><span>Native desktop platforms</span></div>
            <div><strong>2.2</strong><span>WCAG checklist coverage</span></div>
            <div><strong>1</strong><span>Evidence trail from issue to handoff</span></div>
          </div>
        </section>

        <section className="lab-tools" aria-labelledby="tools-heading">
          <div className="lab-shell">
            <div className="lab-section-heading" data-reveal>
              <div>
                <Eyebrow>A connected accessibility workspace</Eyebrow>
                <h2 id="tools-heading">Everything the audit needs.<br /><span>Nothing it doesn&apos;t.</span></h2>
              </div>
              <p>Six focused instruments share the same audit context, so evidence does not disappear between capture, analysis, and reporting.</p>
            </div>

            <div className="lab-tool-grid">
              {TOOLS.map((tool, index) => (
                <article
                  className={`lab-tool-card lab-tool-card--${tool.tone}`}
                  key={tool.title}
                  data-reveal
                  style={{ "--reveal-delay": `${(index % 3) * 55}ms` } as CSSProperties}
                >
                  <div className="lab-tool-card__top">
                    <span>{tool.icon}</span>
                    <small>{tool.label}</small>
                  </div>
                  <h3>{tool.title}</h3>
                  <p>{tool.body}</p>
                  <Link href={tool.href}>{tool.link}<ArrowRightIcon size={15} /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lab-workflow" aria-labelledby="workflow-heading">
          <div className="lab-shell lab-workflow__layout">
            <div className="lab-workflow__copy" data-reveal>
              <Eyebrow>One evidence loop</Eyebrow>
              <h2 id="workflow-heading">From “I found something” to “here&apos;s the fix.”</h2>
              <p>Every step leaves the next person enough context to understand, reproduce, and close the issue.</p>
              <div className="lab-workflow__code"><code>finding.status = &quot;ready_for_review&quot;</code><span>✓ saved locally</span></div>
            </div>

            <ol className="lab-workflow__steps">
              {WORKFLOW.map(([number, title, body], index) => (
                <li key={number} data-reveal style={{ "--reveal-delay": `${index * 55}ms` } as CSSProperties}>
                  <span>{number}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                  <CheckIcon size={17} />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lab-platform" aria-labelledby="platform-heading">
          <div className="lab-shell">
            <div className="lab-section-heading lab-section-heading--platform" data-reveal>
              <div>
                <Eyebrow>Native where it matters</Eyebrow>
                <h2 id="platform-heading">One audit model.<br /><span>Two first-class desktops.</span></h2>
              </div>
              <p>Platform-aware permissions, shortcuts, scaling, window behavior, and signed updates—with a consistent auditor workflow.</p>
            </div>

            <div className="lab-platform__grid">
              <article data-reveal>
                <div className="lab-platform__top"><AppleIcon className="h-9 w-9" /><span>macOS</span></div>
                <h3>Made for the Mac you audit on.</h3>
                <p>Universal Apple Silicon and Intel builds, Mac-native shortcuts, menu-bar access, Screen Recording recovery, and flexible workspaces.</p>
                <Link href="/download">Download for Mac <ArrowRightIcon size={15} /></Link>
              </article>
              <article data-reveal style={{ "--reveal-delay": "70ms" } as CSSProperties}>
                <div className="lab-platform__top"><WindowsIcon className="h-9 w-9" /><span>Windows</span></div>
                <h3>Comfortable, even in a compact window.</h3>
                <p>Native shortcut labels, compact default sizing, responsive reflow, high-DPI rendering, and Windows-aware title-bar behavior.</p>
                <Link href="/download">Download for Windows <ArrowRightIcon size={15} /></Link>
              </article>
            </div>

            <ul className="lab-platform__features" aria-label="Shared desktop features">
              {PLATFORM_FEATURES.map((feature) => <li key={feature}><CheckIcon size={15} />{feature}</li>)}
            </ul>
          </div>
        </section>

        <section className="lab-final" aria-labelledby="final-heading">
          <div className="lab-shell lab-final__layout" data-reveal>
            <div>
              <Eyebrow>Your next audit can be clearer</Eyebrow>
              <h2 id="final-heading">Make the invisible<br />reviewable.</h2>
            </div>
            <div className="lab-final__action">
              <p>Start free on macOS or Windows. Publish only when you choose to share.</p>
              <Link href="/download" className="lab-button lab-button--dark">
                Download TheWCAG <ArrowRightIcon size={18} />
              </Link>
              <small>No credit card · No account required to start</small>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
