import Link from "next/link";
import { AppleIcon, GitHubIcon, WindowsIcon } from "./icons";

const REPO = "https://github.com/Sairo-app/app.thewcag.com";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/download", label: "Download" },
      { href: "/screenshot-tool", label: "Screenshot tool" },
      { href: "/color-contrast-checker", label: "Contrast checker" },
      { href: "/color-blindness-simulator", label: "Color blindness simulator" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/wcag-contrast", label: "WCAG contrast guide" },
      { href: "/accessibility-statement", label: "Accessibility statement" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
              <span className="text-base font-bold tracking-tight">TheWCAG</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              Check WCAG color contrast anywhere on screen, simulate color blindness, and share
              annotated accessibility reports. For macOS and Windows.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/download"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card"
                aria-label="Download for macOS"
              >
                <AppleIcon className="h-3.5 w-3.5" />
                macOS
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card"
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
                className="ml-1 text-muted transition-colors hover:text-foreground"
              >
                <GitHubIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
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
