"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/screenshot-tool", label: "Capture", index: "01" },
  { href: "/color-contrast-checker", label: "Contrast", index: "02" },
  { href: "/color-blindness-simulator", label: "Simulate", index: "03" },
  { href: "/wcag-contrast", label: "Learn", index: "04" },
];

/** Primary marketing nav with active-page highlighting (needs the pathname). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Primary">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`site-nav__link${active ? " site-nav__link--active" : ""}`}
          >
            <span>{n.index}</span>{n.label}
          </Link>
        );
      })}
    </nav>
  );
}
