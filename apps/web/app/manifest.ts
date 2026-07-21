import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TheWCAG Accessibility Audit Workstation",
    short_name: "TheWCAG",
    description: "Plan accessibility audits, capture evidence, manage WCAG findings, retest fixes, and deliver reviewable reports.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f0df",
    theme_color: "#d9480f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
