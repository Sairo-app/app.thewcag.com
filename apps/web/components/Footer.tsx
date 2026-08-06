import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { SAMPLE_REPORT_SLUG } from "@/lib/sample-report";
import {
  AccessibilityIcon,
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EyeIcon,
  FileCheckIcon,
  FlagIcon,
  GitHubIcon,
  ImageIcon,
  LinkIcon,
  LogInIcon,
  WindowsIcon,
} from "./icons";

const REPO = "https://github.com/Sairo-app/app.thewcag.com";

const COLUMNS: { heading: string; links: { href: string; label: string; icon: ReactNode }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/accessibility-audit-software", label: "Audit workstation", icon: <AccessibilityIcon size={20} /> },
      { href: "/accessibility-reporting-software", label: "Accessible reporting", icon: <FileCheckIcon size={20} /> },
      { href: `/s/${SAMPLE_REPORT_SLUG}`, label: "See a sample report", icon: <ImageIcon size={20} /> },
      { href: "/accessibility-issue-tracker-integrations", label: "Issue tracker integrations", icon: <LinkIcon size={20} /> },
      { href: "/accessibility-program-management", label: "Program management", icon: <FlagIcon size={20} /> },
      { href: "/chrome-accessibility-extension", label: "Chrome evidence capture", icon: <CropIcon size={20} /> },
      { href: "/download", label: "Download the app", icon: <DownloadIcon size={20} /> },
      { href: "/pricing", label: "Pricing", icon: <BookIcon size={20} /> },
    ],
  },
  {
    heading: "Tools",
    links: [
      { href: "/screenshot-tool", label: "Screenshot tool", icon: <CropIcon size={20} /> },
      { href: "/color-contrast-checker", label: "Contrast checker", icon: <ContrastIcon size={20} /> },
      { href: "/color-blindness-simulator", label: "Vision simulator", icon: <EyeIcon size={20} /> },
      { href: "/wcag-checklist", label: "WCAG 2.2 checklist", icon: <BookIcon size={20} /> },
      { href: "/screenshots", label: "My published reports", icon: <ImageIcon size={20} /> },
      { href: "/signin", label: "Sign in", icon: <LogInIcon size={20} /> },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/getting-started", label: "Getting started", icon: <BookIcon size={20} /> },
      { href: "/wcag-contrast", label: "WCAG contrast", icon: <BookIcon size={20} /> },
      { href: "/apca-contrast", label: "APCA vs WCAG", icon: <ContrastIcon size={20} /> },
      { href: "/alt-text-guide", label: "Alt text guide", icon: <ImageIcon size={20} /> },
      { href: "/accessibility-statement", label: "Accessibility statement", icon: <AccessibilityIcon size={20} /> },
      { href: "/privacy", label: "Privacy policy", icon: <AccessibilityIcon size={20} /> },
      { href: "/terms", label: "Terms of use", icon: <BookIcon size={20} /> },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__cta-panel">
          <div>
            <p className="site-footer__eyebrow">The evidence trail starts here</p>
            <h2>Every finding should keep its proof.</h2>
            <p>Start free on macOS or Windows. No account is required for local audits.</p>
          </div>
          <Link href="/download" className="site-footer__cta">Get the desktop app <ArrowRightIcon size={20} /></Link>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__lockup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={28} height={28} />
              <span>TheWCAG</span>
            </Link>
            <p className="site-footer__description">A local-first workstation for planning audits, capturing evidence, reviewing WCAG decisions, coordinating remediation, and delivering a defensible record.</p>
            <div className="site-footer__platforms">
              <Link href="/download" className="site-footer__platform" aria-label="Download for macOS"><AppleIcon className="h-4 w-4" />macOS</Link>
              <Link href="/download" className="site-footer__platform" aria-label="Download for Windows"><WindowsIcon className="h-4 w-4" />Windows</Link>
              <a href={REPO} target="_blank" rel="noreferrer" aria-label="TheWCAG on GitHub" className="site-footer__github"><GitHubIcon className="h-5 w-5" /></a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="site-footer__nav">
              <h2>{column.heading}</h2>
              <ul>
                {column.links.map((link) => <li key={link.href}><Link href={link.href} className="site-footer__link"><span>{link.icon}</span>{link.label}</Link></li>)}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} TheWCAG</span>
          <span>Local-first</span>
          <span>WCAG 2.2</span>
          <span>macOS + Windows</span>
        </div>
      </div>
    </footer>
  );
}

/** Inline JSON-LD structured data for rich results. */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
