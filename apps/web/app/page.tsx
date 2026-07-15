import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, JsonLd } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HomeMotion, InspectionStage } from "@/components/HomeExperience";
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

const INSTRUMENTS: {
  icon: ReactNode;
  number: string;
  title: string;
  body: string;
  href: string;
  link: string;
}[] = [
  {
    icon: <ContrastIcon size={22} />,
    number: "01",
    title: "Contrast, measured in context.",
    body: "Sample any foreground and background on screen. Compare WCAG 2.2, AAA, non-text, and APCA results without leaving the interface under review.",
    href: "/color-contrast-checker",
    link: "Explore contrast",
  },
  {
    icon: <CropIcon size={22} />,
    number: "02",
    title: "Evidence that survives the meeting.",
    body: "Capture the exact failure state, annotate it, redact sensitive detail, connect the criterion, and preserve what the auditor actually observed.",
    href: "/screenshot-tool",
    link: "See visual evidence",
  },
  {
    icon: <EyeIcon size={22} />,
    number: "03",
    title: "Vision simulation, live.",
    body: "Move a resizable lens through protanopia, deuteranopia, tritanopia, monochromacy, low acuity, and reduced-contrast views.",
    href: "/color-blindness-simulator",
    link: "Enter the simulator",
  },
  {
    icon: <FlagIcon size={22} />,
    number: "04",
    title: "A living findings register.",
    body: "Search, filter, prioritize, assign status, retain auditor notes, and export a reviewable record in CSV, Markdown, or HTML.",
    href: "/screenshot-tool",
    link: "Review findings",
  },
  {
    icon: <BookIcon size={22} />,
    number: "05",
    title: "The whole WCAG 2.2 audit.",
    body: "Track every Level A and AA criterion with pass, fail, not-applicable, notes, completion progress, and scoped exports.",
    href: "/wcag-checklist",
    link: "Open the checklist",
  },
  {
    icon: <PaletteIcon size={22} />,
    number: "06",
    title: "A palette under pressure.",
    body: "Test every color pairing as a matrix and expose unsafe combinations before they become components, tokens, or production defects.",
    href: "/color-contrast-checker",
    link: "Stress-test a palette",
  },
];

const WORKFLOW = [
  ["01", "Frame", "Record project, scope, target, evaluator, and conformance level."],
  ["02", "Inspect", "Use global shortcuts over websites, apps, prototypes, video, and documents."],
  ["03", "Prove", "Connect each observation to visual evidence, severity, and WCAG criteria."],
  ["04", "Deliver", "Triage the register, export structured files, or publish one focused review link."],
];

const PLATFORM_FEATURES = [
  "Global remappable shortcuts",
  "Responsive narrow-window mode",
  "Automatic light and dark themes",
  "Keyboard-visible focus states",
  "Reduced-motion support",
  "Signed automatic updates",
];

function Kicker({ index, children, light = false }: { index: string; children: ReactNode; light?: boolean }) {
  return (
    <p className={`cinema-kicker${light ? " cinema-kicker--light" : ""}`}>
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

      <main id="main" className="cinema-home">
        <HomeMotion />

        <section className="cinema-hero" aria-labelledby="home-heading">
          <div className="cinema-shell">
            <div className="cinema-hero__rail" data-reveal>
              <span>SCREEN-LEVEL ACCESSIBILITY</span>
              <span>MACOS / WINDOWS</span>
              <span className="cinema-hero__live"><i /> AUDIT INSTRUMENT READY</span>
            </div>

            <div className="cinema-hero__composition">
              <div className="cinema-hero__type" data-reveal style={{ "--reveal-delay": "70ms" } as React.CSSProperties}>
                <p>ACCESSIBILITY, AT THE SPEED OF SIGHT</p>
                <h1 id="home-heading">
                  See what
                  <span>others miss.</span>
                </h1>
              </div>

              <div className="cinema-hero__stage" data-reveal style={{ "--reveal-delay": "170ms" } as React.CSSProperties}>
                <InspectionStage />
              </div>

              <div className="cinema-hero__statement" data-reveal style={{ "--reveal-delay": "260ms" } as React.CSSProperties}>
                <p>
                  A native desktop instrument for the parts of accessibility that browser automation cannot see.
                </p>
                <div className="cinema-actions">
                  <Link href="/download" className="cinema-button cinema-button--primary">
                    Download free <ArrowRightIcon size={17} />
                  </Link>
                  <Link href="/screenshot-tool" className="cinema-button">
                    Explore the workflow
                  </Link>
                </div>
                <small>LOCAL-FIRST / NO ACCOUNT REQUIRED TO START</small>
              </div>
            </div>
          </div>
        </section>

        <section className="cinema-signal" aria-label="Product specifications">
          <div className="cinema-shell cinema-signal__grid">
            <div><strong>6</strong><span>Connected instruments</span></div>
            <div><strong>2</strong><span>Native desktop platforms</span></div>
            <div><strong>2.2</strong><span>WCAG checklist coverage</span></div>
            <div><strong>1</strong><span>Defensible evidence trail</span></div>
          </div>
        </section>

        <section className="cinema-thesis" aria-labelledby="thesis-heading">
          <div className="cinema-shell cinema-thesis__grid">
            <Kicker index="01" light>THE BLIND SPOT</Kicker>
            <div data-reveal>
              <h2 id="thesis-heading">The interface is the evidence.</h2>
              <p>
                Native applications, design prototypes, transient focus states, video, documents, and menus that vanish cannot be understood by the DOM alone. TheWCAG works at screen level—where the experience actually happens.
              </p>
            </div>
            <p className="cinema-thesis__aside" data-reveal>
              Built for accessibility auditors, designers, developers, and quality teams who need to show the issue—not merely report that one exists.
            </p>
          </div>
        </section>

        <section className="cinema-instruments" aria-labelledby="instruments-heading">
          <div className="cinema-shell">
            <div className="cinema-heading" data-reveal>
              <Kicker index="02">THE INSTRUMENTS</Kicker>
              <h2 id="instruments-heading">One system.<br /><span>Six precise views.</span></h2>
              <p>From the first pixel sample to the final client-ready record.</p>
            </div>

            <div className="cinema-instrument-list">
              {INSTRUMENTS.map((instrument, index) => (
                <article
                  className="cinema-instrument"
                  key={instrument.number}
                  data-reveal
                  style={{ "--reveal-delay": `${(index % 2) * 70}ms` } as React.CSSProperties}
                >
                  <div className="cinema-instrument__meta">
                    <span>{instrument.number}</span>
                    {instrument.icon}
                  </div>
                  <h3>{instrument.title}</h3>
                  <p>{instrument.body}</p>
                  <Link href={instrument.href}>{instrument.link}<ArrowRightIcon size={15} /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cinema-loop" aria-labelledby="loop-heading">
          <div className="cinema-shell">
            <div className="cinema-loop__heading" data-reveal>
              <Kicker index="03" light>THE EVIDENCE LOOP</Kicker>
              <h2 id="loop-heading">Observation becomes proof.</h2>
            </div>
            <ol className="cinema-loop__steps">
              {WORKFLOW.map(([number, title, body], index) => (
                <li key={number} data-reveal style={{ "--reveal-delay": `${index * 60}ms` } as React.CSSProperties}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="cinema-platform" aria-labelledby="platform-heading">
          <div className="cinema-shell">
            <div className="cinema-heading cinema-heading--platform" data-reveal>
              <Kicker index="04">TWO DESKTOPS / ONE AUDIT MODEL</Kicker>
              <h2 id="platform-heading">Native where it matters.</h2>
              <p>One consistent workflow with platform-aware shortcuts, permissions, scaling, window behavior, and updates.</p>
            </div>

            <div className="cinema-platform__panels">
              <article data-reveal>
                <div className="cinema-platform__icon"><AppleIcon className="h-9 w-9" /><span>01 / MACOS</span></div>
                <h3>Mac</h3>
                <p>Apple Silicon and Intel builds, menu-bar access, Mac-native shortcut labels, Screen Recording recovery, and resizable workspaces.</p>
                <Link href="/download">Download for Mac <ArrowRightIcon size={15} /></Link>
              </article>
              <article data-reveal style={{ "--reveal-delay": "90ms" } as React.CSSProperties}>
                <div className="cinema-platform__icon"><WindowsIcon className="h-9 w-9" /><span>02 / WINDOWS</span></div>
                <h3>Windows</h3>
                <p>Compact default sizing, Windows shortcut labels, native title-bar behavior, responsive reflow, and high-DPI rendering.</p>
                <Link href="/download">Download for Windows <ArrowRightIcon size={15} /></Link>
              </article>
            </div>

            <ul className="cinema-platform__specs" aria-label="Shared platform features">
              {PLATFORM_FEATURES.map((feature) => <li key={feature}><CheckIcon size={15} />{feature}</li>)}
            </ul>
          </div>
        </section>

        <section className="cinema-final" aria-labelledby="final-heading">
          <div className="cinema-shell cinema-final__layout" data-reveal>
            <Kicker index="05" light>BEGIN THE AUDIT</Kicker>
            <h2 id="final-heading">Make the invisible<br /><span>reviewable.</span></h2>
            <div className="cinema-final__action">
              <p>Start free. Publish only when you choose to share.</p>
              <Link href="/download" className="cinema-button cinema-button--light">
                Download TheWCAG <ArrowRightIcon size={18} />
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
