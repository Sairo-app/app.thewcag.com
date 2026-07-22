"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/getting-started", label: "Getting started" },
  { href: "/accessibility-audit-software", label: "Audit software" },
  { href: "/screenshot-tool", label: "Screenshot tool" },
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
