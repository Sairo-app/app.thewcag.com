import type {
  AuditScopeDiscovery,
  AuditScopeDiscoveryPage,
  AuditScopeFeature,
} from "../../src/shared/desktop";

const MAX_DOCUMENT_BYTES = 1_000_000;
const MAX_DISCOVERED_URLS = 100;
const MAX_INSPECTED_PAGES = 9;
const REQUEST_TIMEOUT_MS = 10_000;

type Fetcher = typeof fetch;

interface PageAnalysis extends AuditScopeDiscoveryPage {
  featureIds: AuditScopeFeature[];
  links: string[];
  commerceScore: number;
  productScore: number;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match);
}

function textContent(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function parseTarget(raw: string): URL {
  const input = raw.trim();
  if (!input) throw new Error("Enter a public website URL before inspecting it.");
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new Error("Website inspection supports HTTP and HTTPS URLs without embedded credentials.");
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS website URL.");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Website inspection supports HTTP and HTTPS URLs without embedded credentials.");
  }
  url.hash = "";
  return url;
}

function safeUrl(raw: string, base: URL, origin: string): string | null {
  try {
    const url = new URL(decodeEntities(raw.trim()), base);
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin || url.username || url.password) return null;
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$)/i.test(name)) url.searchParams.delete(name);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function routePattern(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => {
    if (/^\d+$/.test(segment)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
    if (/^[0-9a-f]{16,}$/i.test(segment)) return ":id";
    return segment.toLowerCase();
  });
  return `/${segments.join("/") || "home"}`;
}

function countMatches(html: string, expression: RegExp): number {
  return Math.min(9, html.match(expression)?.length ?? 0);
}

function analyzeHtml(url: URL, html: string): PageAnalysis {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? "";
  const title = textContent(titleMatch).slice(0, 140) || (url.pathname === "/" ? url.hostname : url.pathname);
  const lower = html.toLowerCase();
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .filter(Boolean)
    .slice(0, MAX_DISCOVERED_URLS);
  const featureIds: AuditScopeFeature[] = [];
  const signals: string[] = [];

  const hasAuthentication = /type\s*=\s*["']?password|\b(sign[ -]?in|log[ -]?in|forgot password|two-factor|create account)\b/i.test(lower)
    || /\/(login|signin|account|register|auth)(?:[/?#"'])/i.test(lower);
  const hasCheckout = /\b(checkout|shopping cart|basket|payment|place order|booking|reservation)\b/i.test(lower)
    || /\/(cart|checkout|basket|payment|booking)(?:[/?#"'])/i.test(lower);
  const hasForms = /<form\b|<(?:input|select|textarea)\b/i.test(lower);
  const hasMedia = /<(?:video|audio|track)\b|\b(captions?|transcript|podcast|livestream)\b/i.test(lower);
  const hasDocuments = /href\s*=\s*["'][^"']+\.(?:pdf|docx?|xlsx?|pptx?)(?:[?#][^"']*)?["']/i.test(lower);
  const hasComponents = /<(?:dialog|details)\b|\brole\s*=\s*["'](?:dialog|menu|tab|tree|grid|combobox)|\baria-(?:expanded|controls|selected|modal)\s*=/i.test(lower);

  if (hasAuthentication) { featureIds.push("authentication"); signals.push("authentication"); }
  if (hasCheckout) { featureIds.push("checkout"); signals.push("transaction"); }
  if (hasForms) { featureIds.push("forms"); signals.push("forms"); }
  if (hasMedia) { featureIds.push("media"); signals.push("media"); }
  if (hasDocuments) { featureIds.push("documents"); signals.push("documents"); }
  if (hasComponents) { featureIds.push("components"); signals.push("interactive components"); }

  const structure = [
    countMatches(html, /<nav\b/gi),
    countMatches(html, /<main\b/gi),
    countMatches(html, /<form\b/gi),
    countMatches(html, /<table\b/gi),
    countMatches(html, /<(?:video|audio)\b/gi),
    countMatches(html, /<(?:dialog|details)\b/gi),
  ].join("-");
  const depth = url.pathname.split("/").filter(Boolean).length;
  const routeClass = depth === 0 ? "home" : `${depth}-segment page`;

  return {
    url: url.toString(),
    title,
    templateKey: `${routeClass} · layout ${structure}`,
    signals,
    featureIds,
    links,
    commerceScore: hasCheckout ? 4 : /\b(product|price|add to (?:cart|basket)|buy now)\b/i.test(lower) ? 2 : 0,
    productScore: (hasAuthentication ? 2 : 0) + (hasComponents ? 1 : 0) + (/\b(dashboard|workspace|portal|profile|settings)\b/i.test(lower) ? 2 : 0),
  };
}

async function responseText(response: Response, label: string): Promise<string> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_DOCUMENT_BYTES) throw new Error(`${label} is larger than the inspection limit.`);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error(`${label} is larger than the inspection limit.`);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function request(fetcher: Fetcher, url: URL, label: string): Promise<{ response: Response; text: string }> {
  const response = await fetcher(url, {
    redirect: "follow",
    credentials: "omit",
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const finalUrl = new URL(response.url || url);
  if (!/^https?:$/.test(finalUrl.protocol) || finalUrl.username || finalUrl.password) {
    throw new Error(`${label} redirected to an unsupported URL.`);
  }
  return { response, text: await responseText(response, label) };
}

function diverseUrls(values: string[], firstUrl: string): string[] {
  const urls = unique([firstUrl, ...values]).slice(0, MAX_DISCOVERED_URLS);
  const selected: string[] = [];
  const patterns = new Set<string>();
  for (const value of urls) {
    const pattern = routePattern(new URL(value));
    if (patterns.has(pattern) && selected.length > 0) continue;
    patterns.add(pattern);
    selected.push(value);
    if (selected.length === MAX_INSPECTED_PAGES) return selected;
  }
  for (const value of urls) {
    if (!selected.includes(value)) selected.push(value);
    if (selected.length === MAX_INSPECTED_PAGES) break;
  }
  return selected;
}

export async function discoverWebsite(rawTarget: string, fetcher: Fetcher = fetch): Promise<AuditScopeDiscovery> {
  const requested = parseTarget(rawTarget);
  const first = await request(fetcher, requested, "The target page");
  const contentType = first.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("html") && !contentType.includes("xhtml")) {
    throw new Error("The target did not return an HTML website page.");
  }
  const finalUrl = new URL(first.response.url || requested);
  finalUrl.hash = "";
  const origin = finalUrl.origin;
  const firstAnalysis = analyzeHtml(finalUrl, first.text);
  const discovered = firstAnalysis.links
    .map((link) => safeUrl(link, finalUrl, origin))
    .filter((value): value is string => Boolean(value));
  const warnings: string[] = [];

  try {
    const sitemapUrl = new URL("/sitemap.xml", origin);
    const sitemap = await request(fetcher, sitemapUrl, "The sitemap");
    if ((sitemap.response.headers.get("content-type") ?? "").includes("xml") || /<(?:urlset|sitemapindex)\b/i.test(sitemap.text)) {
      for (const match of sitemap.text.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
        const value = safeUrl(textContent(match[1]), sitemapUrl, origin);
        if (value && !/\.xml(?:[?#]|$)/i.test(value)) discovered.push(value);
        if (discovered.length >= MAX_DISCOVERED_URLS) break;
      }
    }
  } catch {
    warnings.push("No readable /sitemap.xml was available, so discovery used links on the starting page.");
  }

  const targets = diverseUrls(discovered, finalUrl.toString());
  const analyses: PageAnalysis[] = [firstAnalysis];
  const failures: string[] = [];
  const remaining = targets.filter((url) => url !== finalUrl.toString());
  const inspected = await Promise.allSettled(remaining.map(async (value) => {
    const url = new URL(value);
    const result = await request(fetcher, url, `Page ${url.pathname}`);
    const type = result.response.headers.get("content-type")?.toLowerCase() ?? "";
    if (type && !type.includes("html") && !type.includes("xhtml")) throw new Error("not HTML");
    const actual = new URL(result.response.url || url);
    if (actual.origin !== origin) throw new Error("redirected off site");
    return analyzeHtml(actual, result.text);
  }));
  inspected.forEach((result, index) => {
    if (result.status === "fulfilled") analyses.push(result.value);
    else failures.push(new URL(remaining[index]).pathname || "/");
  });
  if (failures.length) warnings.push(`${failures.length} selected page${failures.length === 1 ? "" : "s"} could not be inspected.`);
  warnings.push("Only public, same-origin pages were inspected. Add authenticated, conditional, third-party, and unlinked states manually.");
  warnings.push("Templates and features are planning signals only; an auditor must confirm the scope and all conformance decisions.");

  const featureIds = unique(analyses.flatMap((page) => page.featureIds));
  const commerceScore = analyses.reduce((total, page) => total + page.commerceScore, 0);
  const productScore = analyses.reduce((total, page) => total + page.productScore, 0);
  const targetType = commerceScore >= 4
    ? "commerce-service"
    : productScore >= 3
      ? "web-product"
      : "content-site";
  const pages = analyses.map(({ featureIds: _featureIds, links: _links, commerceScore: _commerceScore, productScore: _productScore, ...page }) => page);

  return {
    requestedUrl: requested.toString(),
    finalUrl: finalUrl.toString(),
    title: firstAnalysis.title,
    targetType,
    featureIds,
    pages,
    discoveredUrlCount: unique([finalUrl.toString(), ...discovered]).length,
    templateCount: new Set(pages.map((page) => page.templateKey)).size,
    warnings,
    discoveredAt: Date.now(),
  };
}

export const scopeDiscoveryLimits = {
  documentBytes: MAX_DOCUMENT_BYTES,
  discoveredUrls: MAX_DISCOVERED_URLS,
  inspectedPages: MAX_INSPECTED_PAGES,
};
