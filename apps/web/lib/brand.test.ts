import { describe, expect, it } from "vitest";
import { hasValidBrandLogoSignature, isSafeBrandSvg, validateBrandLogoMeta } from "./brand";

describe("brand logo validation", () => {
  it("accepts supported image metadata within the cap", () => {
    expect(validateBrandLogoMeta("image/png", 100)).toBeNull();
    expect(validateBrandLogoMeta("image/svg+xml", 1_000_000)).toBeNull();
    expect(validateBrandLogoMeta("image/gif", 100)).toMatch(/PNG/);
    expect(validateBrandLogoMeta("image/png", 1_000_001)).toMatch(/under 1 MB/);
  });

  it("allows static SVG while blocking active and externally loaded content", () => {
    const bytes = (value: string) => new TextEncoder().encode(value);
    expect(isSafeBrandSvg(bytes('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'))).toBe(true);
    expect(isSafeBrandSvg(bytes('<svg><script>alert(1)</script></svg>'))).toBe(false);
    expect(isSafeBrandSvg(bytes('<svg><image href="https://example.com/a.png" /></svg>'))).toBe(false);
    expect(isSafeBrandSvg(bytes('<svg><a href="javascript:alert(1)">x</a></svg>'))).toBe(false);
    expect(isSafeBrandSvg(bytes('<svg><path onload="alert(1)" /></svg>'))).toBe(false);
  });

  it("verifies raster signatures instead of trusting the browser MIME type", () => {
    expect(hasValidBrandLogoSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidBrandLogoSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasValidBrandLogoSignature("image/png", new TextEncoder().encode("<html>not an image</html>"))).toBe(false);
  });
});
