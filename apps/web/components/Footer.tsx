import type { ReactNode } from "react";
import Link from "next/link";
import {
  AccessibilityIcon,
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  GitHubIcon,
  ImageIcon,
  LogInIcon,
  PaletteIcon,
  WindowsIcon,
} from "./icons";

const REPO = "https://github.com/Sairo-app/app.thewcag.com";

const COLUMNS: { heading: string; links: { href: string; label: string; icon: ReactNode }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/accessibility-audit-software", label: "Audit workstation", icon: <AccessibilityIcon size={15} /> },
      { href: "/chrome-accessibility-extension", label: "Chrome extension", icon: <CropIcon size={15} /> },
      { href: "/screenshot-tool", label: "Screenshot tool", icon: <CropIcon size={15} /> },
      { href: "/color-contrast-checker", label: "Contrast checker", icon: <ContrastIcon size={15} /> },
      { href: "/download", label: "Download the app", icon: <DownloadIcon size={15} /> },
    ],
  },
  {
    heading: "Workspace",
    links: [
      { href: "/signin", label: "Sign in", icon: <LogInIcon size={15} /> },
      { href: "/screenshots", label: "My reports", icon: <ImageIcon size={15} /> },
      { href: "/brand", label: "Report branding", icon: <PaletteIcon size={15} /> },
    ],
  },
  {
    heading: "Guides",
    links: [
      { href: "/wcag-contrast", label: "WCAG contrast", icon: <BookIcon size={15} /> },
      { href: "/wcag-checklist", label: "WCAG 2.2 checklist", icon: <BookIcon size={15} /> },
      { href: "/apca-contrast", label: "APCA vs WCAG", icon: <ContrastIcon size={15} /> },
      { href: "/alt-text-guide", label: "Alt text guide", icon: <ImageIcon size={15} /> },
      { href: "/accessibility-statement", label: "Accessibility statement", icon: <AccessibilityIcon size={15} /> },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__cta-panel">
          <div>
            <h2>Audit what people see. Keep the proof.</h2>
            <p>Start free on macOS or Windows. No account is required for local audits.</p>
          </div>
          <Link href="/download" className="site-footer__cta">
            Download free <ArrowRightIcon size={16} />
          </Link>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__lockup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={28} height={28} />
              <span>TheWCAG</span>
            </Link>
            <p className="site-footer__description">
              Plan the audit, inspect rendered interfaces, capture browser and desktop evidence, confirm findings, retest fixes, and deliver only what you choose.
            </p>
            <div className="site-footer__platforms">
              <Link href="/download" className="site-footer__platform" aria-label="Download for macOS"><AppleIcon className="h-[15px] w-[15px]" />macOS</Link>
              <Link href="/download" className="site-footer__platform" aria-label="Download for Windows"><WindowsIcon className="h-[15px] w-[15px]" />Windows</Link>
              <a href={REPO} target="_blank" rel="noreferrer" aria-label="TheWCAG on GitHub" className="site-footer__github"><GitHubIcon className="h-[19px] w-[19px]" /></a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="site-footer__nav">
              <h2>{column.heading}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="site-footer__link"><span>{link.icon}</span>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} TheWCAG</span>
          <span>Local-first</span>
          <span>WCAG 2.2</span>
          <span>macOS and Windows</span>
        </div>
      </div>
    </footer>
  );
}

/** Inline JSON-LD structured data for rich results. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
