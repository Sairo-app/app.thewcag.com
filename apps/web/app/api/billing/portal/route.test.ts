import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  auth: vi.fn(),
  reserveBillingSession: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: boundary.auth }));
vi.mock("@/lib/billing/session-rate-limit", () => ({
  BillingSessionRateLimitError: class BillingSessionRateLimitError extends Error {},
  completeBillingSession: vi.fn(),
  reserveBillingSession: boundary.reserveBillingSession,
}));
vi.mock("@/lib/billing/dodo", () => ({
  dodoClient: vi.fn(),
  requireDodoHostedUrl: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/schema", () => ({ billingCustomers: {} }));

import { GET } from "./route";

describe("billing portal request boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a cross-site resource request before auth or rate-limit reservation", async () => {
    const request = new NextRequest("https://app.thewcag.com/api/billing/portal", {
      headers: {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-dest": "image",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "cross_site_request_rejected" });
    expect(boundary.auth).not.toHaveBeenCalled();
    expect(boundary.reserveBillingSession).not.toHaveBeenCalled();
  });

  it("rejects requests without browser fetch metadata", async () => {
    const response = await GET(new NextRequest("https://app.thewcag.com/api/billing/portal"));

    expect(response.status).toBe(403);
    expect(boundary.auth).not.toHaveBeenCalled();
  });
});
