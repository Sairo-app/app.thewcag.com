"use client";

import { useEffect, useRef, useState, useTransition } from "react";

/** Two-step destructive action button for the admin panel. First click arms it
 *  (auto-disarms after 3s), second click runs the server action. */
export function AdminConfirmButton({
  label,
  confirmLabel,
  action,
}: {
  label: string;
  confirmLabel: string;
  action: () => Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!armed) {
    return (
      <button
        onClick={() => {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-red-600 dark:hover:text-red-400"
      >
        {label}
      </button>
    );
  }
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        startTransition(async () => {
          await action();
          setArmed(false);
        });
      }}
      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Deleting…" : confirmLabel}
    </button>
  );
}
