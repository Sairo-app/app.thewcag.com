import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, createPageMetadata, SITE_URL } from "./seo";

describe("SEO metadata", () => {
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
});
