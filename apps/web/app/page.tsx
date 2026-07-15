import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuditField, HomeMotion } from "@/components/HomeExperience";
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
  number: string;
  title: string;
  body: string;
  href: string;
  link: string;
  featured?: boolean;
}[] = [
  {
    icon: <ContrastIcon size={21} />,
    number: "01",
    title: "Sample any pixel. Prove the contrast.",
    body: "Pick foreground and background pixels from any browser, native app, design file, or video. See WCAG 2.2, AAA, UI-component, and APCA results in one evidence-ready view.",
    href: "/color-contrast-checker",
    link: "Explore contrast",
    featured: true,
  },
  {
    icon: <CropIcon size={21} />,
    number: "02",
    title: "Capture the exact failure state.",
    body: "Mark locations, classify severity, attach WCAG criteria, measure targets, redact details, and preserve what the auditor actually observed.",
    href: "/screenshot-tool",
    link: "See the capture workflow",
  },
  {
    icon: <EyeIcon size={21} />,
    number: "03",
    title: "Move through another visual experience.",
    body: "Review protanopia, deuteranopia, tritanopia, monochromacy, low acuity, and low-contrast vision through a live resizable lens.",
    href: "/color-blindness-simulator",
    link: "Explore simulations",
  },
  {
    icon: <FlagIcon size={21} />,
    number: "04",
    title: "Keep findings in one living register.",
    body: "Search and filter by severity or status, move issues from open to fixed, and export client-ready CSV, Markdown, or HTML.",
    href: "/screenshot-tool",
    link: "Review findings",
  },
  {
    icon: <BookIcon size={21} />,
    number: "05",
    title: "Track the whole WCAG 2.2 audit.",
    body: "Work through every Level A and AA success criterion with pass, fail, not-applicable, notes, completion progress, and scoped exports.",
    href: "/wcag-checklist",
    link: "Open the checklist",
    featured: true,
  },
  {
    icon: <PaletteIcon size={21} />,
    number: "06",
    title: "Stress-test a palette before launch.",
    body: "Compare a complete color system as a pairwise matrix and catch unsafe combinations before they become components or design tokens.",
    href: "/color-contrast-checker",
    link: "Check a palette",
  },
];

const WORKFLOW = [
  {
    number: "01",
    title: "Frame the audit",
    body: "Record the project, target, scope, conformance level, evaluator, and start date so the evidence remains traceable.",
    meta: "CONTEXT / SCOPE",
  },
  {
    number: "02",
    title: "Inspect the real experience",
    body: "Use global shortcuts over websites, desktop apps, prototypes, documents, and transient states that browser-only tools cannot reach.",
    meta: "OBSERVE / MEASURE",
  },
  {
    number: "03",
    title: "Turn observation into proof",
    body: "Capture the failure, connect the criterion, add severity and remediation context, and keep the original visual evidence.",
    meta: "CAPTURE / VERIFY",
  },
  {
    number: "04",
    title: "Deliver a reviewable record",
    body: "Triage findings, export structured deliverables, or publish a branded screenshot report to one focused review link.",
    meta: "TRIAGE / SHARE",
  },
];

const PLATFORM_FEATURES = [
  "Global, remappable shortcuts",
  "Responsive narrow-window mode",
  "Automatic light and dark themes",
  "Keyboard-visible focus states",
  "Reduced-motion support",
  "Automatic update support",
];

function SectionLabel({ index, children, inverted = false }: { index: string; children: ReactNode; inverted?: boolean }) {
  return (
    <p className={`section-label${inverted ? " section-label--inverted" : ""}`}>
      <span>{index}</span>
      {children}
    </p>
  );
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
      <main id="main" className="home-page">
        <HomeMotion />

        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-shell">
            <div className="home-hero__topline" data-reveal>
              <span>ACCESSIBILITY FIELD SYSTEM / 01</span>
              <span className="home-hero__status"><i /> DESKTOP TOOLKIT ONLINE</span>
            </div>

            <div className="home-hero__grid">
              <div className="home-hero__copy" data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
                <p className="home-hero__kicker">THE AUDITOR&apos;S DESKTOP COMPANION</p>
                <h1 id="home-heading">
                  Audit the
                  <span>unseen.</span>
                </h1>
                <div className="home-hero__intro">
                  <p>
                    Contrast, vision simulation, visual evidence, WCAG 2.2 tracking, and structured findings—across every interface on your screen.
                  </p>
                  <div className="home-actions">
                    <Link href="/download" className="action-block action-block--primary">
                      <span>Download free</span>
                      <ArrowRightIcon size={18} />
                    </Link>
                    <Link href="/screenshot-tool" className="action-block action-block--secondary">
                      <span>Enter the workflow</span>
                      <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="home-hero__visual" data-reveal style={{ "--reveal-delay": "180ms" } as React.CSSProperties}>
                <AuditField />
                <p className="home-hero__visual-note"><span>MOVE POINTER</span> / INSPECT THE FIELD</p>
              </div>
            </div>

            <ul className="home-proof-rail" aria-label="Product qualities" data-reveal>
              <li><span>01</span><strong>WCAG 2.2</strong><small>A + AA checklist</small></li>
              <li><span>02</span><strong>APCA</strong><small>Side-by-side scoring</small></li>
              <li><span>03</span><strong>MAC + WINDOWS</strong><small>One audit model</small></li>
              <li><span>04</span><strong>LOCAL FIRST</strong><small>Share only by choice</small></li>
            </ul>
          </div>
        </section>

        <section className="home-manifesto" aria-labelledby="manifesto-heading">
          <div className="home-shell home-manifesto__grid">
            <SectionLabel index="02">THE EVIDENCE GAP</SectionLabel>
            <div data-reveal>
              <h2 id="manifesto-heading">A DOM scan cannot see <em>everything.</em></h2>
              <p>
                Native apps. Design prototypes. Videos. Menus that disappear. Focus states that only exist for a moment. TheWCAG works at screen level, where the experience actually happens.
              </p>
            </div>
            <div className="home-manifesto__index" aria-hidden="true">A11Y<br />/360°</div>
          </div>
        </section>

        <section className="home-toolkit" aria-labelledby="toolkit-heading">
          <div className="home-shell">
            <div className="home-section-heading" data-reveal>
              <SectionLabel index="03">THE INSTRUMENTS</SectionLabel>
              <h2 id="toolkit-heading">Tools that follow the <span>real interface.</span></h2>
              <p>One connected system from first observation to defensible finding.</p>
            </div>

            <div className="tool-field">
              {TOOLS.map((tool, index) => (
                <article
                  key={tool.title}
                  className={`tool-module${tool.featured ? " tool-module--featured" : ""}`}
                  data-reveal
                  style={{ "--reveal-delay": `${(index % 3) * 70}ms` } as React.CSSProperties}
                >
                  <div className="tool-module__topline">
                    <span>{tool.number} / 06</span>
                    <span className="tool-module__icon">{tool.icon}</span>
                  </div>
                  <h3>{tool.title}</h3>
                  <p>{tool.body}</p>
                  <Link href={tool.href}>
                    {tool.link}
                    <ArrowRightIcon size={16} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-workflow" aria-labelledby="workflow-heading">
          <div className="home-shell home-workflow__layout">
            <div className="home-workflow__intro" data-reveal>
              <SectionLabel index="04" inverted>THE EVIDENCE LOOP</SectionLabel>
              <h2 id="workflow-heading">From pixel<br />to proof.</h2>
              <p>A deliberate audit trail without heavyweight project software.</p>
              <Link href="/wcag-checklist" className="action-block action-block--light">
                <span>View WCAG checklist</span>
                <ArrowRightIcon size={17} />
              </Link>
            </div>

            <ol className="workflow-track">
              {WORKFLOW.map((step, index) => (
                <li key={step.number} data-reveal style={{ "--reveal-delay": `${index * 60}ms` } as React.CSSProperties}>
                  <div className="workflow-track__number">{step.number}</div>
                  <div className="workflow-track__body">
                    <span>{step.meta}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <span className="workflow-track__marker" aria-hidden="true">+</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-platform" aria-labelledby="platform-heading">
          <div className="home-shell">
            <div className="home-platform__heading" data-reveal>
              <SectionLabel index="05">CROSS-PLATFORM / NATIVE WHERE IT MATTERS</SectionLabel>
              <h2 id="platform-heading">One audit.<br /><span>Two desktops.</span></h2>
              <p>
                The shared audit model stays consistent while each build respects platform window controls, global shortcuts, capture permissions, scaling, and resizable layouts.
              </p>
            </div>

            <div className="platform-grid">
              <article className="platform-panel" data-reveal>
                <div className="platform-panel__header">
                  <AppleIcon className="h-11 w-11" />
                  <span>BUILD / MACOS</span>
                </div>
                <h3>macOS</h3>
                <p>Menu-bar access, Mac-native shortcut labels, Screen Recording recovery, vibrancy, and resizable workspaces.</p>
                <Link href="/download">Download for Mac <ArrowRightIcon size={15} /></Link>
              </article>
              <article className="platform-panel platform-panel--dark" data-reveal style={{ "--reveal-delay": "90ms" } as React.CSSProperties}>
                <div className="platform-panel__header">
                  <WindowsIcon className="h-11 w-11" />
                  <span>BUILD / WINDOWS</span>
                </div>
                <h3>Windows</h3>
                <p>Compact default sizing, Windows shortcut labels, native title bar, responsive reflow, and high-DPI webview rendering.</p>
                <Link href="/download">Download for Windows <ArrowRightIcon size={15} /></Link>
              </article>
              <div className="platform-spec" data-reveal>
                <span className="platform-spec__label">SHARED SYSTEM LAYER</span>
                <ul>
                  {PLATFORM_FEATURES.map((feature) => (
                    <li key={feature}><CheckIcon size={15} />{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="home-final" aria-labelledby="final-heading">
          <div className="home-shell home-final__layout" data-reveal>
            <div>
              <SectionLabel index="06">BEGIN THE AUDIT</SectionLabel>
              <h2 id="final-heading">Make the invisible <span>reviewable.</span></h2>
            </div>
            <div className="home-final__action">
              <p>Start free. No account is required until you choose to publish a shareable report.</p>
              <Link href="/download" className="action-block action-block--primary action-block--large">
                <span>Download TheWCAG</span>
                <ArrowRightIcon size={20} />
              </Link>
              <small>MACOS + WINDOWS / LOCAL-FIRST</small>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
