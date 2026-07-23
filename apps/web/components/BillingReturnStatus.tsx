"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function BillingReturnStatus() {
  const [state, setState] = useState<"checking" | "active" | "waiting" | "error">("checking");
  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    async function check() {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json() as { plan?: string };
        if (stopped) return;
        if (data.plan === "pro") return setState("active");
        attempt += 1;
        if (attempt >= 10) return setState("waiting");
        window.setTimeout(check, 1_500);
      } catch {
        if (!stopped) setState("error");
      }
    }
    void check();
    return () => { stopped = true; };
  }, []);

  if (state === "checking") return <p role="status">Confirming your subscription…</p>;
  if (state === "active") return <><p role="status" className="font-semibold text-green-800">Pro is active on your account.</p><Link href="/account" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 type-body font-semibold text-primary-foreground">Open account</Link></>;
  if (state === "waiting") return <><p role="status">Your payment was returned successfully, but confirmation is still arriving. This usually takes only a moment.</p><Link href="/account" className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 type-body font-semibold">Check account</Link></>;
  return <><p role="alert">We could not refresh the subscription status. Your payment is not affected.</p><Link href="/account" className="mt-4 underline">Check account</Link></>;
}
