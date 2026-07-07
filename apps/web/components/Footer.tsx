import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/download", label: "Download" },
  { href: "/screenshot-tool", label: "Screenshot tool" },
  { href: "/color-contrast-checker", label: "Contrast checker" },
  { href: "/wcag-contrast", label: "WCAG contrast guide" },
  { href: "/color-blindness-simulator", label: "Color blindness simulator" },
  { href: "/accessibility-statement", label: "Accessibility statement" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={20} height={20} className="h-5 w-5" />
          <span className="font-semibold">TheWCAG</span>
          <span className="text-muted">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
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
