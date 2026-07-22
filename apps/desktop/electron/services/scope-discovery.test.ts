import { describe, expect, it, vi } from "vitest";
import { discoverWebsite, scopeDiscoveryLimits } from "./scope-discovery";

function response(url: string, body: string, contentType = "text/html"): Response {
  const value = new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("website scope discovery", () => {
  it("selects exact same-origin pages and detects transactional templates", async () => {
    const pages = new Map<string, Response>([
      ["https://shop.example/", response("https://shop.example/", `
        <html><head><title>Example shop</title></head><body>
          <nav><a href="/products/widget?utm_source=test">Widget</a><a href="/account/login">Sign in</a></nav>
          <main><button aria-expanded="false">Categories</button></main>
        </body></html>
      `)],
      ["https://shop.example/sitemap.xml", response("https://shop.example/sitemap.xml", `
        <urlset><url><loc>https://shop.example/checkout</loc></url><url><loc>https://outside.example/private</loc></url></urlset>
      `, "application/xml")],
      ["https://shop.example/products/widget", response("https://shop.example/products/widget", `
        <html><head><title>Widget</title></head><body><main><p>Price £10</p><button>Add to cart</button></main></body></html>
      `)],
      ["https://shop.example/account/login", response("https://shop.example/account/login", `
        <html><head><title>Sign in</title></head><body><main><form><input type="email"><input type="password"></form></main></body></html>
      `)],
      ["https://shop.example/checkout", response("https://shop.example/checkout", `
        <html><head><title>Checkout</title></head><body><main><form><input><button>Place order</button></form></main></body></html>
      `)],
    ]);
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const value = pages.get(url);
      if (!value) return new Response("missing", { status: 404 });
      return value.clone();
    }) as typeof fetch;

    const result = await discoverWebsite("shop.example", fetcher);

    expect(result.targetType).toBe("commerce-service");
    expect(result.featureIds).toEqual(expect.arrayContaining(["authentication", "checkout", "forms", "components"]));
    expect(result.pages.map((page) => page.url)).toEqual(expect.arrayContaining([
      "https://shop.example/",
      "https://shop.example/products/widget",
      "https://shop.example/account/login",
      "https://shop.example/checkout",
    ]));
    expect(result.pages.some((page) => page.url.includes("outside.example"))).toBe(false);
    expect(result.pages).toHaveLength(4);
    expect(result.warnings.at(-1)).toContain("planning signals only");
  });

  it("bounds response size and rejects non-website targets", async () => {
    const tooLarge = vi.fn(async () => new Response("x", {
      status: 200,
      headers: { "content-length": String(scopeDiscoveryLimits.documentBytes + 1), "content-type": "text/html" },
    })) as typeof fetch;
    await expect(discoverWebsite("https://example.com", tooLarge)).rejects.toThrow("larger than the inspection limit");
    await expect(discoverWebsite("file:///etc/passwd", tooLarge)).rejects.toThrow("HTTP and HTTPS");
  });

  it("limits the number of pages requested from a large home page", async () => {
    const links = Array.from({ length: 30 }, (_, index) => `<a href="/page-${index}">Page</a>`).join("");
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input.toString() : String(input);
      if (url.endsWith("/sitemap.xml")) return new Response("missing", { status: 404 });
      return response(url, `<html><head><title>Page</title></head><body>${links}</body></html>`);
    }) as typeof fetch;
    const result = await discoverWebsite("https://example.com", fetcher);
    expect(result.pages.length).toBe(scopeDiscoveryLimits.inspectedPages);
    expect(fetcher).toHaveBeenCalledTimes(scopeDiscoveryLimits.inspectedPages + 1);
  });
});
