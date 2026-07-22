"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Desktop account disclosure with the same predictable dismissal behavior as
 * the mobile menu: Escape restores focus, outside clicks close the panel, and
 * navigation never leaves a stale menu open on the next page.
 */
export function AccountMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    ref.current?.removeAttribute("open");
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    function close(restoreFocus = false) {
      details!.removeAttribute("open");
      setOpen(false);
      if (restoreFocus) details!.querySelector("summary")?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && details!.open) close(true);
    }

    function onPointerDown(event: PointerEvent) {
      if (details!.open && !details!.contains(event.target as Node)) close();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <details
      ref={ref}
      className="account-menu"
      onToggle={() => setOpen(Boolean(ref.current?.open))}
    >
      <summary aria-label={open ? "Close account menu" : "Open account menu"}>
        Account
      </summary>
      {children}
    </details>
  );
}
