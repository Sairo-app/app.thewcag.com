import { describe, expect, it } from "vitest";
import { buildSitemap, PUBLIC_ROUTES } from "./sitemap";

describe("sitemap", () => {
  it("uses the generation time instead of a frozen release date", () => {
    const generatedAt = new Date("2027-01-15T12:00:00.000Z");
    const entries = buildSitemap(generatedAt);

    expect(entries).toHaveLength(PUBLIC_ROUTES.length);
    expect(entries.every((entry) => entry.lastModified === generatedAt)).toBe(true);
  });
});
