"use client";

import { useEffect } from "react";

export function ReportViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void fetch(`/api/s/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);
  return null;
}
