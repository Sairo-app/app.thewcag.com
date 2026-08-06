"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/accessibility-audit-software", label: "Product" },
  { href: "/getting-started", label: "Workflow" },
  { href: "/screenshot-tool", label: "Capture" },
  { href: "/accessibility-reporting-software", label: "Reporting" },
  { href: "/accessibility-issue-tracker-integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
];

/** Primary marketing nav with active-page highlighting (needs the pathname). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Primary">
      {NAV.map((n) => {
        const active = n.href.startsWith("/#") ? false : pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`site-nav__link${active ? " site-nav__link--active" : ""}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
