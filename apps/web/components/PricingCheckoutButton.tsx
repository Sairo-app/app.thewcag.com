"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PlanChoice } from "@/lib/billing/plans";

export function PricingCheckoutButton({
  plan,
  signedIn,
  configured,
  autoStart = false,
}: {
  plan: PlanChoice;
  signedIn: boolean;
  configured: boolean;
  autoStart?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!autoStart || !signedIn || !configured || autoStarted.current) return;
    autoStarted.current = true;
    void checkout();
  }, [autoStart, configured, signedIn]);
  if (!signedIn) {
    return (
      <Link href={`/signin?callbackUrl=${encodeURIComponent(`/pricing?plan=${plan}`)}`} className="pricing-card__button">
        Sign in to subscribe
      </Link>
    );
  }
  if (!configured) {
    return <span className="pricing-card__button pricing-card__button--disabled">Subscriptions opening soon</span>;
  }

  async function checkout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = await response.json() as { url?: string; message?: string };
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setError(result.message || "Checkout could not be started. Please try again.");
    } catch {
      setError("Checkout could not be started. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={checkout} disabled={pending} className="pricing-card__button">
        {pending ? "Opening secure checkout…" : "Choose Pro"}
      </button>
      {error ? <p role="alert" className="mt-2 type-body text-red-700">{error}</p> : null}
    </>
  );
}
