"use client";

import { useEffect, useRef } from "react";

export function HomeMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".home-page");
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return null;
}

export function AuditField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const field = fieldRef.current;
    if (!field) return;
    const bounds = field.getBoundingClientRect();
    const x = Math.max(28, Math.min(bounds.width - 28, event.clientX - bounds.left));
    const y = Math.max(28, Math.min(bounds.height - 28, event.clientY - bounds.top));

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      field.style.setProperty("--pointer-x", `${x}px`);
      field.style.setProperty("--pointer-y", `${y}px`);
    });
  }

  return (
    <div
      ref={fieldRef}
      className="audit-field"
      role="img"
      aria-label="TheWCAG inspecting a checkout interface and reporting a 6.83 to 1 contrast ratio that passes WCAG AA and AAA"
      onPointerMove={handlePointerMove}
    >
      <div className="audit-field__chrome" aria-hidden="true">
        <div className="audit-field__identity">
          <span className="audit-field__signal" />
          <span>LIVE_INSPECTION</span>
        </div>
        <span>FRAME 0042 / WEB</span>
      </div>

      <div className="audit-field__viewport" aria-hidden="true">
        <div className="audit-field__axis audit-field__axis--x" />
        <div className="audit-field__axis audit-field__axis--y" />
        <div className="audit-field__coordinates">X 0684 / Y 0312</div>

        <div className="audit-field__mock">
          <span className="audit-field__mock-label">CHECKOUT / PAYMENT</span>
          <div className="audit-field__mock-line audit-field__mock-line--long" />
          <div className="audit-field__mock-line" />
          <div className="audit-field__mock-button">CONTINUE TO PAYMENT</div>
        </div>

        <div className="audit-field__issue">
          <span>01</span>
          <strong>FOCUS INDICATOR</strong>
        </div>

        <div className="audit-field__reticle">
          <span className="audit-field__reticle-ring" />
          <span className="audit-field__reticle-dot" />
          <span className="audit-field__reticle-label">SAMPLE</span>
        </div>
      </div>

      <div className="audit-field__result" aria-hidden="true">
        <div>
          <span className="audit-field__eyebrow">CONTRAST RATIO</span>
          <strong>6.83<span>:1</span></strong>
        </div>
        <div className="audit-field__swatches">
          <span className="audit-field__swatch audit-field__swatch--dark">#19181C</span>
          <span className="audit-field__swatch audit-field__swatch--light">#FAF9FC</span>
        </div>
        <div className="audit-field__verdicts">
          <span>AA / PASS</span>
          <span>AAA / PASS</span>
        </div>
      </div>
    </div>
  );
}
