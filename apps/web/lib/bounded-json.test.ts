import { describe, expect, it } from "vitest";
import { readBoundedJson, readBoundedText, RequestBodyTooLargeError } from "./bounded-json";

describe("bounded JSON requests", () => {
  it("parses a request within the byte limit", async () => {
    const request = new Request("https://app.thewcag.com/api/test", {
      method: "POST",
      body: JSON.stringify({ evidence: "safe" }),
    });
    await expect(readBoundedJson(request, 100)).resolves.toEqual({ evidence: "safe" });
  });

  it("rejects a streamed body even when Content-Length is absent", async () => {
    const encoder = new TextEncoder();
    const request = new Request("https://app.thewcag.com/api/test", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"evidence":"'));
          controller.enqueue(encoder.encode("x".repeat(200)));
          controller.enqueue(encoder.encode('"}'));
          controller.close();
        },
      }),
      // Required by Node's Request implementation for a streaming body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readBoundedJson(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects an oversized declared Content-Length before reading", async () => {
    const request = new Request("https://app.thewcag.com/api/test", {
      method: "POST",
      headers: { "Content-Length": "101" },
      body: "{}",
    });
    await expect(readBoundedJson(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("preserves the exact bounded webhook text used for signature verification", async () => {
    const raw = '{"type":"subscription.active", "value": 1}\n';
    const request = new Request("https://app.thewcag.com/api/billing/webhooks", { method: "POST", body: raw });
    await expect(readBoundedText(request, 1_000)).resolves.toBe(raw);
  });
});
