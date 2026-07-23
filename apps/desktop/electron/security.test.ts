import { describe, expect, it } from "vitest";
import { confirmableExternalUrl, safeExternalUrl } from "./security";

describe("external URL policy", () => {
  it.each([
    "https://app.thewcag.com/getting-started",
    "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    "https://w3.org/WAI/standards-guidelines/wcag/",
    "https://platform.openai.com/api-keys",
    "https://console.anthropic.com/settings/keys",
    "https://openrouter.ai/settings/keys",
  ])("allows the curated HTTPS destination %s", (url) => {
    expect(safeExternalUrl(url)).toBe(url);
  });

  it("allows only the exact origin loaded from connector configuration", () => {
    const origins = ["https://company.atlassian.net", "https://linear.app", "https://github.com"];
    expect(safeExternalUrl("https://company.atlassian.net/browse/A11Y-42", origins))
      .toBe("https://company.atlassian.net/browse/A11Y-42");
    expect(safeExternalUrl("https://linear.app/team/issue/A11Y-8", origins))
      .toBe("https://linear.app/team/issue/A11Y-8");
    expect(safeExternalUrl("https://github.com/example/product/issues/17", origins))
      .toBe("https://github.com/example/product/issues/17");
    expect(() => safeExternalUrl("https://evil.company.atlassian.net/browse/A11Y-42", origins)).toThrow();
  });

  it.each([
    "http://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    "https://w3.org.attacker.example/phishing",
    "https://platform.openai.com.attacker.example/api-keys",
    "https://user:password@openrouter.ai/settings/keys",
    "https://audited.example/page",
    "javascript:alert(1)",
    "file:///etc/passwd",
  ])("blocks a non-allowlisted trusted link %s", (url) => {
    expect(() => safeExternalUrl(url)).toThrow("External URL is not allowed");
  });

  it("accepts arbitrary HTTP(S) audited pages only through the confirmation policy", () => {
    expect(confirmableExternalUrl("https://audited.example/private/path"))
      .toBe("https://audited.example/private/path");
    expect(confirmableExternalUrl("http://127.0.0.1:4173/local-audit"))
      .toBe("http://127.0.0.1:4173/local-audit");
    expect(() => confirmableExternalUrl("file:///private/audit.html")).toThrow();
    expect(() => confirmableExternalUrl("https://user:secret@audited.example/")).toThrow();
  });
});
