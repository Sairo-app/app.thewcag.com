import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

/** Static, indexable marketing + tool pages. Auth/API routes stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/download", priority: 0.9 },
    { path: "/screenshot-tool", priority: 0.8 },
    { path: "/color-contrast-checker", priority: 0.8 },
    { path: "/wcag-contrast", priority: 0.8 },
    { path: "/wcag-checklist", priority: 0.8 },
    { path: "/apca-contrast", priority: 0.7 },
    { path: "/alt-text-guide", priority: 0.7 },
    { path: "/color-blindness-simulator", priority: 0.7 },
    { path: "/accessibility-statement", priority: 0.5 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  }));
}
