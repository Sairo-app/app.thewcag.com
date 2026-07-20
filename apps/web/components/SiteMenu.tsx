"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon } from "./icons";

/**
 * Mobile navigation disclosure. A plain <details> only closes when its
 * summary is clicked again, so this adds the behavior people expect from a
 * menu: close on Escape (returning focus to the trigger), on any click or
 * tap outside the panel, and after navigating to another page.
 */
export function SiteMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details!.open) return;
      details!.removeAttribute("open");
      details!.querySelector("summary")?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (details!.open && !details!.contains(event.target as Node)) {
        details!.removeAttribute("open");
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <details ref={ref} className="site-menu">
      <summary aria-label="Open navigation menu" className="site-menu__trigger">
        <MenuIcon size={16} />
        <span>Menu</span>
      </summary>
      <div className="site-menu__panel">{children}</div>
    </details>
  );
}
