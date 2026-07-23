"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteScreenshot } from "@/app/screenshots/actions";
import { TrashIcon } from "./icons";

export function DeleteButton({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus to the confirm action when the two-step opens, so keyboard and
  // screen-reader users land on it instead of being dropped to <body>.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <span>
        <button
          onClick={() => { setError(""); setConfirming(true); }}
          className="inline-flex items-center gap-1 type-callout text-muted hover:text-red-700"
        >
          <TrashIcon size={20} />
          Delete
        </button>
        {error ? <span role="alert" className="ml-2 type-callout text-red-700">{error}</span> : null}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 type-callout">
      <button
        ref={confirmRef}
        disabled={pending}
        onClick={() => startTransition(async () => {
          try {
            await deleteScreenshot(slug);
            setConfirming(false);
          } catch {
            setError("The report could not be deleted. Try again.");
            setConfirming(false);
          }
        })}
        className="font-medium text-red-700 hover:underline disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted hover:underline">
        Cancel
      </button>
    </span>
  );
}
