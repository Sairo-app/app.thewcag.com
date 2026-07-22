import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  verifyDeviceToken: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/device-auth", () => ({
  verifyDeviceToken: boundary.verifyDeviceToken,
}));
vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: (value: unknown) => {
        boundary.updateSet(value);
        return {
          where: async (condition: unknown) => {
            boundary.updateWhere(condition);
          },
        };
      },
    })),
  },
}));

import { DELETE } from "./route";

function request(token?: string, claimedDevice = "device-other") {
  return new NextRequest("https://app.thewcag.com/api/device/revoke", {
    method: "DELETE",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-device-id": claimedDevice,
    },
  });
}

function primitiveValues(value: unknown, seen = new WeakSet<object>()): unknown[] {
  if (value === null || typeof value !== "object") return [value];
  if (seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((child) => primitiveValues(child, seen));
}

describe("device revoke route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.verifyDeviceToken.mockResolvedValue({
      userId: "user-owner",
      deviceId: "device-current",
    });
  });

  it("rejects an unauthenticated request", async () => {
    boundary.verifyDeviceToken.mockResolvedValue(null);

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("rejects an already revoked token", async () => {
    boundary.verifyDeviceToken.mockResolvedValue(null);

    const response = await DELETE(request("revoked-device-token"));

    expect(response.status).toBe(401);
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("revokes only the authenticated device and ignores a claimed different device id", async () => {
    const response = await DELETE(request("valid-token", "device-other"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revoked: true });
    expect(boundary.updateSet).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
    const conditionValues = primitiveValues(boundary.updateWhere.mock.calls[0]?.[0]);
    expect(conditionValues).toContain("device-current");
    expect(conditionValues).not.toContain("device-other");
  });
});
