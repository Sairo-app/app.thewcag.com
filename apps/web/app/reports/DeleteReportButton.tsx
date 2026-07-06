"use client";

import { useState, useTransition } from "react";
import { deleteReport } from "./actions";

export function DeleteReportButton({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-muted hover:text-red-600">
        Delete
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        disabled={pending}
        onClick={() => startTransition(() => deleteReport(slug))}
        className="font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted hover:underline">
        Cancel
      </button>
    </span>
  );
}
