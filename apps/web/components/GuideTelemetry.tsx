"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const CONSENT_KEY = "thewcag:funnel-telemetry-consent";
const SENT_KEY = "thewcag:funnel-guide-download-attempted";

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browser storage is optional. A failed write keeps telemetry off.
  }
}

function emitGuideToDownload(): void {
  if (stored(CONSENT_KEY) !== "true" || stored(SENT_KEY) === "true") return;
  save(SENT_KEY, "true");
  const body = JSON.stringify({ event: "guide_to_download" });
  const beaconAccepted = typeof navigator.sendBeacon === "function"
    ? navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }))
    : false;
  if (!beaconAccepted) {
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function GuideTelemetryConsent() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(stored(CONSENT_KEY) === "true");
  }, []);

  return (
    <label className="guide-telemetry-consent">
      <input
        type="checkbox"
        checked={consented}
        onChange={(event) => {
          setConsented(event.target.checked);
          save(CONSENT_KEY, event.target.checked ? "true" : "false");
        }}
      />
      <span>
        <strong>Share one anonymous guide milestone</strong>
        <small>
          If enabled, the first move from this guide to Download sends only the event name. No account,
          identifier, URL, audit data, or device details are attached.
        </small>
      </span>
    </label>
  );
}

export function GuideDownloadLink({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Link href="/download" className={className} onClick={emitGuideToDownload}>
      {children}
    </Link>
  );
}
