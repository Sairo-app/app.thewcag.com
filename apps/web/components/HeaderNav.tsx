"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CompassIcon,
  CropIcon,
  FileCheckIcon,
  FileTextIcon,
  LinkIcon,
  TagIcon,
} from "@/components/icons";

const NAV = [
  { href: "/getting-started", label: "Getting started", icon: CompassIcon },
  { href: "/accessibility-audit-software", label: "Audit software", icon: FileCheckIcon },
  { href: "/screenshot-tool", label: "Screenshot tool", icon: CropIcon },
  { href: "/accessibility-reporting-software", label: "Reporting", icon: FileTextIcon },
  { href: "/accessibility-issue-tracker-integrations", label: "Integrations", icon: LinkIcon },
  { href: "/pricing", label: "Pricing", icon: TagIcon },
];

/** Primary marketing nav with active-page highlighting (needs the pathname). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Primary">
      {NAV.map((n) => {
        const active = n.href.startsWith("/#") ? false : pathname === n.href;
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`site-nav__link${active ? " site-nav__link--active" : ""}`}
          >
            <Icon size={16} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
