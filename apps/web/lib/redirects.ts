/** Keep post-auth navigation on this site. */
export function safeCallbackPath(value: unknown, fallback = "/screenshots"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "https://app.thewcag.com");
    if (parsed.origin !== "https://app.thewcag.com") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
