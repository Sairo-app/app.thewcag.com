import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

/** Static, indexable marketing + tool pages. Auth/API routes stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-22T00:00:00.000Z");
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/getting-started", priority: 0.95, changeFrequency: "monthly" },
    { path: "/accessibility-audit-software", priority: 0.95, changeFrequency: "weekly" },
    { path: "/chrome-accessibility-extension", priority: 0.9, changeFrequency: "weekly" },
    { path: "/download", priority: 0.9, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/screenshot-tool", priority: 0.8, changeFrequency: "monthly" },
    { path: "/color-contrast-checker", priority: 0.8, changeFrequency: "monthly" },
    { path: "/wcag-contrast", priority: 0.8, changeFrequency: "monthly" },
    { path: "/wcag-checklist", priority: 0.8, changeFrequency: "monthly" },
    { path: "/apca-contrast", priority: 0.7, changeFrequency: "monthly" },
    { path: "/alt-text-guide", priority: 0.7, changeFrequency: "monthly" },
    { path: "/color-blindness-simulator", priority: 0.7, changeFrequency: "monthly" },
    { path: "/accessibility-statement", priority: 0.5, changeFrequency: "yearly" },
  ];
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
