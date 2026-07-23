import { describe, expect, it } from "vitest";
import sitemap, { PUBLIC_ROUTES } from "../app/sitemap";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL, siteUrlFromEnvironment } from "./seo";

describe("SEO metadata", () => {
  it("normalizes trailing slashes and rejects non-origin production URLs", () => {
    expect(siteUrlFromEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.thewcag.com///",
    })).toBe("https://app.thewcag.com");
    expect(() => siteUrlFromEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.thewcag.com/reports",
    })).toThrow(/must be an origin/);
    expect(() => siteUrlFromEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://app.thewcag.com",
    })).toThrow(/HTTPS/);
  });
  it("creates an absolute social URL and a route-specific canonical", () => {
    const metadata = createPageMetadata({
      title: "Chrome accessibility extension",
      description: "Capture contextual browser evidence and send a reviewed finding into a local audit.",
      path: "/chrome-accessibility-extension",
    });
    expect(metadata.alternates).toEqual({ canonical: "/chrome-accessibility-extension" });
    expect(metadata.openGraph).toMatchObject({
      url: `${SITE_URL}/chrome-accessibility-extension`,
      images: [expect.objectContaining({ width: 1200, height: 630 })],
    });
  });

  it("numbers breadcrumb items and resolves absolute URLs", () => {
    expect(breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Audit software", path: "/accessibility-audit-software" },
    ])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: `${SITE_URL}/` },
        { position: 2, item: `${SITE_URL}/accessibility-audit-software` },
      ],
    });
  });

  it("keeps every public product-intent page in a unique canonical sitemap", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toHaveLength(new Set(urls).size);
    expect(PUBLIC_ROUTES.map((route) => route.path)).toEqual(expect.arrayContaining([
      "/accessibility-reporting-software",
      "/accessibility-issue-tracker-integrations",
      "/accessibility-program-management",
      "/privacy",
      "/terms",
    ]));
    expect(urls).toEqual(expect.arrayContaining([
      `${SITE_URL}/accessibility-reporting-software`,
      `${SITE_URL}/accessibility-issue-tracker-integrations`,
      `${SITE_URL}/accessibility-program-management`,
    ]));
    expect(urls.some((url) => url.includes("/api/") || url.includes("/account"))).toBe(false);
  });
});
