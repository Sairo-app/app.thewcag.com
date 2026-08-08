import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const settingsView = readFileSync(new URL("./views/SettingsView.tsx", import.meta.url), "utf8");

describe("settings toggle styling", () => {
  it("uses the shared control geometry without overflowing the track", () => {
    expect(styles).toMatch(
      /\.toggle-row input\[type="checkbox"\][^{]*\{[^}]*width: var\(--control-height-standard\);[^}]*height: var\(--space-6\);/s,
    );
    expect(styles).toMatch(
      /\.toggle-row input\[type="checkbox"\]::after[^}]*\{[^}]*width: var\(--space-5\);[^}]*height: var\(--space-5\);/s,
    );
    expect(styles).toContain("translateX(var(--space-5))");
    expect(styles).not.toContain("translateX(14px)");
  });

  it("keeps focus, reduced-motion, and forced-colors states explicit", () => {
    expect(styles).toMatch(/\.toggle-row input\[type="checkbox"\]:focus-visible/);
    expect(styles).toMatch(/\.toggle-row input\[type="checkbox"\]:checked[^{]*\{[^}]*background: Highlight;/s);
    expect(styles).toMatch(/html\[data-motion="reduced"\] \.toggle-row input\[type="checkbox"\]/);
  });

  it("exposes each binary preference as a switch", () => {
    expect(settingsView.match(/role="switch"/g)).toHaveLength(5);
  });
});
