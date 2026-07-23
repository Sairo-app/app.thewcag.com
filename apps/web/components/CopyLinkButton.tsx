"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "./icons";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked; the URL is still visible in the address bar */
          }
        }}
        aria-label={copied ? "Link copied" : "Copy link"}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 type-body font-medium hover:bg-card"
        }
      >
        {copied ? <CheckIcon size={20} /> : <LinkIcon size={20} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </>
  );
}
