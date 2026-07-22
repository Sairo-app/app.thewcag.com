"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Website route failed", error);
  }, [error]);
  return (
    <main id="main" className="auth-page mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">This page could not be loaded</h1>
      <p className="mt-3 text-sm text-muted">Your data was not changed. Try the request again, or return to the home page.</p>
      <div className="mt-6 flex gap-3"><button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button><a href="/" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Home</a></div>
    </main>
  );
}
