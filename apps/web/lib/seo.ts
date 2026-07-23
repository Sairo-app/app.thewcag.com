import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://app.thewcag.com";

export function siteUrlFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): string {
  const raw = environment.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
  if (!/^\/+$/u.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an origin without a path, credentials, query, or fragment.");
  }
  if (url.protocol !== "https:" && !(environment.NODE_ENV !== "production" && url.protocol === "http:")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  return url.origin;
}

export const SITE_URL = siteUrlFromEnvironment();

export const PRODUCT_DESCRIPTION =
  "TheWCAG is a local-first accessibility audit workstation for macOS and Windows with WCAG 2.2 planning, finding-owned evidence, remediation tickets, accessible reports, retesting, and program trends.";

export const SOCIAL_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "TheWCAG accessibility audit workstation",
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: `/${string}` | "/";
  keywords?: string[];
}): Metadata {
  const url = new URL(path, SITE_URL).toString();
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "TheWCAG",
      locale: "en_US",
      url,
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE.url],
    },
    robots: { index: true, follow: true },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: `/${string}` | "/" }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}
