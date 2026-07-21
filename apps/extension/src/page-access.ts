export function isProtectedBrowserPage(url: string): boolean {
  if (!url) return false;
  return /^(?:chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

export function pageAccessMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/(?:chrome|chrome-extension|edge|about|devtools):\/\//i.test(message) || /Chrome Web Store/i.test(message)) {
    return "This browser page is protected by Chrome. Switch to a normal website and reopen TheWCAG. Localhost pages are supported.";
  }
  if (/Cannot access contents|active tab|host permission|permission to access/i.test(message)) {
    return "This tab has not granted page access. Reopen TheWCAG from the Chrome toolbar, then try the capture again.";
  }
  return "The page could not be captured. Reload the website, reopen TheWCAG from the toolbar, and try again.";
}
