import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com").replace(/\/+$/, "");

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
