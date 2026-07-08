import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep auth + private + API surfaces out of the index.
      disallow: ["/api/", "/admin", "/brand", "/connect", "/signin", "/signin/check", "/screenshots"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
