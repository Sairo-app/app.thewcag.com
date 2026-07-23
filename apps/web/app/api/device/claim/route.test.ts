import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({ claimDevice: vi.fn() }));

vi.mock("@/lib/device-claim", () => ({
  claimDevice: boundary.claimDevice,
  isValidDeviceClaimCode: (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
}));

import { POST } from "./route";

const CODE = "a".repeat(64);

function request(body: unknown = { code: CODE }, contentType = "application/json") {
  return new NextRequest("https://app.thewcag.com/api/device/claim", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

describe("device claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a bearer token only after a successful claim", async () => {
    boundary.claimDevice.mockResolvedValue({
      status: "claimed",
      token: "b".repeat(64),
      expiresAt: new Date("2026-10-21T00:00:00.000Z"),
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      token: "b".repeat(64),
      expiresAt: "2026-10-21T00:00:00.000Z",
    });
    expect(boundary.claimDevice).toHaveBeenCalledWith(CODE);
  });

  it("rejects an expired code", async () => {
    boundary.claimDevice.mockResolvedValue({ status: "expired" });

    const response = await POST(request());

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ error: "claim_expired" });
  });

  it("rejects a replayed code", async () => {
    boundary.claimDevice.mockResolvedValue({ status: "replayed" });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "claim_already_used" });
  });

  it("rejects malformed or over-specified payloads before storage", async () => {
    const response = await POST(request({ code: CODE, token: "attacker-supplied" }));

    expect(response.status).toBe(400);
    expect(boundary.claimDevice).not.toHaveBeenCalled();
  });
});
