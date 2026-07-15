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
    heading: "Tools",
    links: [
      { href: "/screenshot-tool", label: "Screenshot tool", icon: <CropIcon size={14} /> },
      { href: "/color-contrast-checker", label: "Contrast checker", icon: <ContrastIcon size={14} /> },
      { href: "/color-blindness-simulator", label: "Color blindness simulator", icon: <EyeIcon size={14} /> },
      { href: "/download", label: "Download", icon: <DownloadIcon size={14} /> },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/signin", label: "Sign in", icon: <LogInIcon size={14} /> },
      { href: "/screenshots", label: "My screenshots", icon: <ImageIcon size={14} /> },
      { href: "/brand", label: "White-label branding", icon: <PaletteIcon size={14} /> },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/wcag-contrast", label: "WCAG contrast guide", icon: <BookIcon size={14} /> },
      { href: "/wcag-checklist", label: "WCAG 2.2 checklist", icon: <BookIcon size={14} /> },
      { href: "/apca-contrast", label: "APCA vs WCAG 2", icon: <ContrastIcon size={14} /> },
      { href: "/alt-text-guide", label: "Alt text guide", icon: <ImageIcon size={14} /> },
      { href: "/accessibility-statement", label: "Accessibility statement", icon: <AccessibilityIcon size={14} /> },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__masthead" aria-hidden="true">THEWCAG</div>
        <div className="site-footer__grid">
          {/* Brand */}
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__lockup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={26} height={26} />
              <span>TheWCAG / ACCESSIBILITY FIELD SYSTEM</span>
            </Link>
            <p className="site-footer__description">
              Check WCAG color contrast anywhere on screen, simulate color blindness, and share
              annotated accessibility reports. For macOS and Windows.
            </p>
            <div className="site-footer__platforms">
              <Link
                href="/download"
                className="site-footer__platform"
                aria-label="Download for macOS"
              >
                <AppleIcon className="h-3.5 w-3.5" />
                macOS
              </Link>
              <Link
                href="/download"
                className="site-footer__platform"
                aria-label="Download for Windows"
              >
                <WindowsIcon className="h-3.5 w-3.5" />
                Windows
              </Link>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                aria-label="TheWCAG on GitHub"
                className="site-footer__github"
              >
                <GitHubIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="site-footer__nav">
              <h2>
                {col.heading}
              </h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="site-footer__link"
                    >
                      <span className="text-muted/70">{l.icon}</span>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} TheWCAG. All rights reserved.</span>
          <span>Built to WCAG 2.2 AA, for macOS and Windows.</span>
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
