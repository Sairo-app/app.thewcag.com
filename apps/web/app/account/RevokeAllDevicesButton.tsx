"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { revokeAllDevices } from "./actions";

export function RevokeAllDevicesButton() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return <span><button
      type="button"
      onClick={() => { setError(""); setConfirming(true); }}
      className="rounded-lg border border-border px-3 py-2 type-body font-medium hover:bg-background"
    >Revoke all devices</button>{error ? <span role="alert" className="mt-1 block type-callout text-red-700">{error}</span> : null}</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <button
        ref={confirmRef}
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          try {
            await revokeAllDevices();
            setConfirming(false);
          } catch {
            setError("The devices could not be revoked. Try again.");
            setConfirming(false);
          }
        })}
        className="rounded-lg bg-red-700 px-3 py-2 type-body font-semibold text-white disabled:opacity-60"
      >{pending ? "Revoking…" : "Confirm revoke all"}</button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="type-body text-muted hover:underline">Cancel</button>
    </span>
  );
}
