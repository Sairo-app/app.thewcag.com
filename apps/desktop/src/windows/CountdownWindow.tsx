import { useEffect, useState } from "react";

declare global {
  interface Window {
    __COUNTDOWN_MS?: number;
  }
}

/**
 * Tiny always-on-top HUD shown during delayed capture. Rust closes this
 * window right before the frame freezes, so it never appears in the shot.
 */
export default function CountdownWindow() {
  const total = Math.round((window.__COUNTDOWN_MS ?? 3000) / 1000);
  const [left, setLeft] = useState(total);

  useEffect(() => {
    const timer = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen items-center gap-3 rounded-xl border border-border bg-card/90 px-4 font-sans backdrop-blur-xl">
      <span
        key={left}
        className="rise inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-base font-bold text-primary-foreground"
      >
        {left}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">Capturing soon</p>
        <p className="text-[10px] text-muted-foreground">open your hover state now</p>
      </div>
    </div>
  );
}
