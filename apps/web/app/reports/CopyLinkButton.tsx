"use client";

import { useState } from "react";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={className ?? "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-card"}
    >
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}
