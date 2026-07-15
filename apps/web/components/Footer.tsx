import type { ReactNode } from "react";
import Link from "next/link";
import {
  AccessibilityIcon,
  AppleIcon,
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EyeIcon,
  GitHubIcon,
  ImageIcon,
  LogInIcon,
  PaletteIcon,
  WindowsIcon,
} from "./icons";

const REPO = "https://github.com/Sairo-app/app.thewcag.com";

const COLUMNS: { heading: string; links: { href: string; label: string; icon: ReactNode }[] }[] = [
  {
    heading: "Instruments",
    links: [
      { href: "/screenshot-tool", label: "Screenshot evidence", icon: <CropIcon size={14} /> },
      { href: "/color-contrast-checker", label: "Contrast checker", icon: <ContrastIcon size={14} /> },
      { href: "/color-blindness-simulator", label: "Vision simulator", icon: <EyeIcon size={14} /> },
      { href: "/download", label: "Desktop download", icon: <DownloadIcon size={14} /> },
    ],
  },
  {
    heading: "Workspace",
    links: [
      { href: "/signin", label: "Sign in", icon: <LogInIcon size={14} /> },
      { href: "/screenshots", label: "My reports", icon: <ImageIcon size={14} /> },
      { href: "/brand", label: "Report branding", icon: <PaletteIcon size={14} /> },
    ],
  },
  {
    heading: "Standards",
    links: [
      { href: "/wcag-contrast", label: "WCAG contrast", icon: <BookIcon size={14} /> },
      { href: "/wcag-checklist", label: "WCAG 2.2 checklist", icon: <BookIcon size={14} /> },
      { href: "/apca-contrast", label: "APCA vs WCAG", icon: <ContrastIcon size={14} /> },
      { href: "/alt-text-guide", label: "Alt text guide", icon: <ImageIcon size={14} /> },
      { href: "/accessibility-statement", label: "Accessibility statement", icon: <AccessibilityIcon size={14} /> },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__headline" aria-hidden="true">AUDIT. PROVE. SHIP.</div>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__lockup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={26} height={26} />
              <span>THEWCAG</span>
            </Link>
            <p className="site-footer__description">
              A practical accessibility lab for macOS and Windows. Inspect any interface, keep the evidence, and hand off findings people can act on.
            </p>
            <div className="site-footer__platforms">
              <Link href="/download" className="site-footer__platform" aria-label="Download for macOS"><AppleIcon className="h-3.5 w-3.5" />macOS</Link>
              <Link href="/download" className="site-footer__platform" aria-label="Download for Windows"><WindowsIcon className="h-3.5 w-3.5" />Windows</Link>
              <a href={REPO} target="_blank" rel="noreferrer" aria-label="TheWCAG on GitHub" className="site-footer__github"><GitHubIcon className="h-5 w-5" /></a>
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
          <span>Designed for WCAG 2.2 AA / Built for macOS + Windows</span>
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
