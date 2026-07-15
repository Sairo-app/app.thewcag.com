"use client";

import { useEffect, useRef } from "react";

export function HomeMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".cinema-home");
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

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        target.setAttribute("data-visible", "true");
        return;
      }
      observer.observe(target);
    });
    return () => observer.disconnect();
  }, []);

  return null;
}

export function InspectionStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(42, Math.min(bounds.width - 42, event.clientX - bounds.left));
    const y = Math.max(64, Math.min(bounds.height - 118, event.clientY - bounds.top));

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      stage.style.setProperty("--focus-x", `${x}px`);
      stage.style.setProperty("--focus-y", `${y}px`);
    });
  }

  return (
    <div
      ref={stageRef}
      className="inspection-stage"
      role="img"
      aria-label="TheWCAG inspecting a checkout interface and reporting a 6.83 to 1 contrast ratio that passes WCAG AA and AAA"
      onPointerMove={handlePointerMove}
    >
      <div className="inspection-stage__top" aria-hidden="true">
        <span>THEWCAG / INSPECT</span>
        <span className="inspection-stage__live"><i /> LIVE</span>
      </div>

      <div className="inspection-stage__canvas" aria-hidden="true">
        <div className="inspection-stage__window">
          <div className="inspection-stage__window-bar"><i /><i /><i /><span>CHECKOUT / PAYMENT</span></div>
          <div className="inspection-stage__window-copy">
            <small>COMPLETE ORDER</small>
            <strong>Make payment</strong>
            <span />
            <span />
            <div className="inspection-stage__mock-button">Continue to payment</div>
          </div>
        </div>

        <div className="inspection-stage__focus">
          <span className="inspection-stage__focus-ring" />
          <span className="inspection-stage__focus-cross inspection-stage__focus-cross--x" />
          <span className="inspection-stage__focus-cross inspection-stage__focus-cross--y" />
        </div>

        <div className="inspection-stage__finding">
          <span>01</span>
          <div><small>FINDING</small><strong>Focus indicator</strong></div>
        </div>
      </div>

      <div className="inspection-stage__result" aria-hidden="true">
        <div><small>CONTRAST RATIO</small><strong>6.83<span>:1</span></strong></div>
        <div className="inspection-stage__samples"><span>#19181C</span><span>#FAF9FC</span></div>
        <div className="inspection-stage__verdict"><small>WCAG 2.2</small><strong>AAA / PASS</strong></div>
      </div>
    </div>
  );
}
