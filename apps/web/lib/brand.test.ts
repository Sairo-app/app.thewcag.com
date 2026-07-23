import { describe, expect, it } from "vitest";
import { brandLogoPath, hasValidBrandLogoSignature, isBrandAssetToken, validateBrandLogoMeta } from "./brand";

describe("brand logo validation", () => {
  it("recognizes opaque brand asset tokens without accepting user UUIDs", () => {
    expect(isBrandAssetToken("br_0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isBrandAssetToken("72f3c21a-a5a5-4f08-a2ae-f790448519e7")).toBe(false);
    expect(brandLogoPath("br_0123456789abcdef0123456789abcdef")).toBe(
      "/api/brand/br_0123456789abcdef0123456789abcdef/logo",
    );
    expect(brandLogoPath("72f3c21a-a5a5-4f08-a2ae-f790448519e7")).toBeNull();
  });
  it("accepts supported image metadata within the cap", () => {
    expect(validateBrandLogoMeta("image/png", 100)).toBeNull();
    expect(validateBrandLogoMeta("image/svg+xml", 1_000_000)).toMatch(/PNG/);
    expect(validateBrandLogoMeta("image/gif", 100)).toMatch(/PNG/);
    expect(validateBrandLogoMeta("image/png", 1_000_001)).toMatch(/under 1 MB/);
  });

  it("verifies raster signatures instead of trusting the browser MIME type", () => {
    expect(hasValidBrandLogoSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidBrandLogoSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasValidBrandLogoSignature("image/png", new TextEncoder().encode("<html>not an image</html>"))).toBe(false);
  });
});
