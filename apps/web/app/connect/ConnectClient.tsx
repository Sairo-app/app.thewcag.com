"use client";

import { useState } from "react";
import { authorizeDevice } from "./actions";

export function ConnectClient({ state, device, email }: { state: string; device: string; email: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);

  async function connect() {
    setStatus("working");
    try {
      const url = await authorizeDevice(state, device);
      setLink(url);
      setStatus("done");
      window.location.href = url;
    } catch {
      setStatus("error");
    }
  }

  return (
    <main id="main" className="auth-page mx-auto max-w-md px-6 py-marketing-section text-center">
      <h1 className="type-title-2 font-bold ">Connect your desktop app</h1>
      <p className="mt-3 type-body text-muted">
        Authorize <strong>{device}</strong> to use your TheWCAG account (
        <span className="font-medium">{email}</span>) to publish and manage shared screenshots.
      </p>

      {status !== "done" && (
        <button
          onClick={connect}
          disabled={status === "working"}
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-3 type-body font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {status === "working" ? "Authorizing…" : "Authorize this device"}
        </button>
      )}
      {status === "done" && (
        <div className="mt-6 type-body text-muted" role="status" aria-live="polite">
          <p>Opening TheWCAG to finish connecting…</p>
          {link && (
            <p className="mt-2">
              Didn&apos;t switch automatically?{" "}
              <a href={link} className="font-medium text-primary hover:underline">
                Finish in the app
              </a>
            </p>
          )}
        </div>
      )}
      {status === "error" && (
        <p className="mt-6 type-body text-red-700" role="alert">
          Something went wrong. Try connecting again from the app.
        </p>
      )}
    </main>
  );
}
