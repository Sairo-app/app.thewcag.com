import { describe, expect, it } from "vitest";
import { isProtectedBrowserPage, pageAccessMessage } from "./page-access";

describe("browser page access", () => {
  it("allows normal websites and localhost", () => {
    expect(isProtectedBrowserPage("https://example.com/account")).toBe(false);
    expect(isProtectedBrowserPage("http://localhost:5173/")).toBe(false);
    expect(isProtectedBrowserPage("")).toBe(false);
  });

  it("identifies browser-owned pages", () => {
    expect(isProtectedBrowserPage("chrome://settings/")).toBe(true);
    expect(isProtectedBrowserPage("chrome-extension://abcdefghijklmnop/popup.html")).toBe(true);
    expect(isProtectedBrowserPage("devtools://devtools/bundled/inspector.html")).toBe(true);
  });

  it("does not mislabel a missing activeTab grant as a protected page", () => {
    expect(pageAccessMessage(new Error(
      'Cannot access contents of url "http://localhost:5173/". Extension manifest must request permission to access the respective host.',
    ))).toMatch(/has not granted page access/i);
  });
});
