"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ContrastIcon, CropIcon, EyeIcon } from "@/components/icons";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/screenshot-tool", label: "Screenshot tool", icon: <CropIcon size={15} /> },
  { href: "/color-contrast-checker", label: "Contrast checker", icon: <ContrastIcon size={15} /> },
  { href: "/color-blindness-simulator", label: "Color blindness", icon: <EyeIcon size={15} /> },
  { href: "/wcag-contrast", label: "Guide", icon: <BookIcon size={15} /> },
];

/** Primary marketing nav with active-page highlighting (needs the pathname). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-5 text-sm md:flex" aria-label="Primary">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 ${
              active ? "font-medium text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {n.icon}
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
