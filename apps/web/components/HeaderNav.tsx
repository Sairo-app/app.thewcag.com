"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/screenshot-tool", label: "Screenshot tool" },
  { href: "/color-contrast-checker", label: "Contrast checker" },
  { href: "/wcag-contrast", label: "Guide" },
];

/** Primary marketing nav with active-page highlighting (needs the pathname). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-5 text-sm sm:flex" aria-label="Primary">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={active ? "font-medium text-foreground" : "text-muted hover:text-foreground"}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
