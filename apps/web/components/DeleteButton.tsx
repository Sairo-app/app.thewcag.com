"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteScreenshot } from "@/app/screenshots/actions";
import { TrashIcon } from "./icons";

export function DeleteButton({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus to the confirm action when the two-step opens, so keyboard and
  // screen-reader users land on it instead of being dropped to <body>.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-600 dark:hover:text-red-400"
      >
        <TrashIcon size={13} />
        Delete
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        ref={confirmRef}
        disabled={pending}
        onClick={() => startTransition(() => deleteScreenshot(slug))}
        className="font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted hover:underline">
        Cancel
      </button>
    </span>
  );
}
