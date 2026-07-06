"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "./icons";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-card"
      }
    >
      {copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
