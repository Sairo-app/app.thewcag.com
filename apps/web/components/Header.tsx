import Link from "next/link";

const NAV = [
  { href: "/screenshot-tool", label: "Screenshot tool" },
  { href: "/color-contrast-checker", label: "Contrast checker" },
  { href: "/wcag-contrast", label: "Guide" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="text-sm font-bold tracking-tight">TheWCAG</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/download"
          className="ml-auto rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Download
        </Link>
      </div>
    </header>
  );
}
