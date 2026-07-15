"use client";

import { useEffect, useId, useState } from "react";

const MODES = ["Contrast", "Evidence", "Vision"] as const;
type Mode = (typeof MODES)[number];

export function HomeMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".lab-home");
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    page?.setAttribute("data-motion-ready", "true");

    if (reducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.setAttribute("data-visible", "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.08 },
    );

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        target.setAttribute("data-visible", "true");
      } else {
        observer.observe(target);
      }
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

function ContrastPanel() {
  return (
    <div className="audit-playground__contrast">
      <div className="audit-playground__swatches" aria-hidden="true">
        <div className="audit-playground__swatch audit-playground__swatch--dark"><span>#24261F</span></div>
        <div className="audit-playground__swatch audit-playground__swatch--light"><span>#F5F1E8</span></div>
      </div>
      <div className="audit-playground__result">
        <div>
          <span className="audit-playground__label">Contrast ratio</span>
          <strong>12.78<small>:1</small></strong>
        </div>
        <div className="audit-playground__badges" aria-label="Passes WCAG AA and AAA">
          <span><i /> AA pass</span>
          <span><i /> AAA pass</span>
        </div>
      </div>
      <p className="audit-playground__hint">Sampled from the real screen—not reconstructed from CSS.</p>
    </div>
  );
}

function EvidencePanel() {
  return (
    <div className="audit-playground__evidence">
      <div className="audit-playground__capture" aria-hidden="true">
        <div className="audit-playground__capture-bar"><i /><i /><i /><span>checkout / payment</span></div>
        <div className="audit-playground__capture-body">
          <span className="audit-playground__mock-title" />
          <span className="audit-playground__mock-line" />
          <span className="audit-playground__mock-line audit-playground__mock-line--short" />
          <span className="audit-playground__annotation">1</span>
          <span className="audit-playground__focus-outline" />
          <span className="audit-playground__mock-button">Continue</span>
        </div>
      </div>
      <div className="audit-playground__finding">
        <span className="audit-playground__label">Finding 01</span>
        <strong>Focus indicator is obscured</strong>
        <p>2.4.11 · Focus Not Obscured (Minimum)</p>
        <div><span>Major</span><span>Open</span></div>
      </div>
    </div>
  );
}

function VisionPanel() {
  return (
    <div className="audit-playground__vision">
      <div className="audit-playground__vision-card audit-playground__vision-card--source">
        <span className="audit-playground__label">Original</span>
        <div aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
      <span className="audit-playground__vision-arrow" aria-hidden="true">→</span>
      <div className="audit-playground__vision-card audit-playground__vision-card--simulated">
        <span className="audit-playground__label">Deuteranopia</span>
        <div aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
      <p>Move a live lens across any application and catch meaning that disappears with color.</p>
    </div>
  );
}

export function AuditPlayground() {
  const [mode, setMode] = useState<Mode>("Contrast");
  const id = useId();

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = MODES.indexOf(mode);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? MODES.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + MODES.length) % MODES.length;
    setMode(MODES[next]);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    tabs?.[next]?.focus();
  }

  return (
    <div className="audit-playground" aria-label="Interactive preview of TheWCAG desktop tools">
      <div className="audit-playground__chrome">
        <div className="audit-playground__title">
          <span className="audit-playground__mark" aria-hidden="true">W</span>
          <div><strong>TheWCAG</strong><small>Audit lab · live preview</small></div>
        </div>
        <span className="audit-playground__local"><i /> Local</span>
      </div>

      <div className="audit-playground__tabs" role="tablist" aria-label="Preview a desktop tool">
        {MODES.map((item) => (
          <button
            key={item}
            id={`${id}-${item}-tab`}
            type="button"
            role="tab"
            aria-selected={mode === item}
            aria-controls={`${id}-${item}-panel`}
            tabIndex={mode === item ? 0 : -1}
            onClick={() => setMode(item)}
            onKeyDown={handleKeyDown}
          >
            {item}
          </button>
        ))}
      </div>

      <div
        id={`${id}-${mode}-panel`}
        className="audit-playground__panel"
        role="tabpanel"
        aria-labelledby={`${id}-${mode}-tab`}
      >
        {mode === "Contrast" && <ContrastPanel />}
        {mode === "Evidence" && <EvidencePanel />}
        {mode === "Vision" && <VisionPanel />}
      </div>

      <div className="audit-playground__status">
        <span><kbd>⌘⇧C</kbd> Capture anywhere</span>
        <span>WCAG 2.2 · AA</span>
      </div>
    </div>
  );
}
