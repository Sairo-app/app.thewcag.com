"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AdminActionResult } from "@/lib/admin-action";

/** Two-step destructive action button for the admin panel. First click arms it
 *  (auto-disarms after 3s), second click runs the server action. */
export function AdminConfirmButton({
  label,
  confirmLabel,
  action,
}: {
  label: string;
  confirmLabel: string;
  action: () => Promise<AdminActionResult>;
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!armed) {
    return <span className="inline-flex flex-col items-end gap-1"><button
      onClick={() => {
        setError("");
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
      }}
      className="rounded-md border border-border px-3 py-1 type-callout text-muted hover:text-red-700"
    >{label}</button>{error ? <span role="alert" className="max-w-40 text-right type-callout text-red-700">{error}</span> : null}</span>;
  }
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        startTransition(async () => {
          try {
            const result = await action();
            if (!result.ok) {
              setError(result.reason);
              setArmed(false);
              return;
            }
            setError("");
            setArmed(false);
          } catch {
            setError("The action failed. Try again.");
            setArmed(false);
          }
        });
      }}
      className="rounded-md bg-red-600 px-3 py-1 type-callout font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Deleting…" : confirmLabel}
    </button>
  );
}
