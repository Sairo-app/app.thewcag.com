import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; userId: string }>,
  selectWhere: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn<(condition?: unknown) => Promise<void>>(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: (condition: unknown) => {
          boundary.selectWhere(condition);
          return { limit: async () => boundary.rows };
        },
      }),
    })),
    update: vi.fn(() => ({
      set: (value: unknown) => {
        boundary.updateSet(value);
        return {
          where: (condition: unknown) => {
            return boundary.updateWhere(condition);
          },
        };
      },
    })),
  },
}));

import { hashToken, verifyDeviceToken } from "./device-auth";

describe("device bearer authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.rows = [];
    boundary.updateWhere.mockResolvedValue(undefined);
  });

  it("rejects missing and malformed authorization without querying storage", async () => {
    await expect(verifyDeviceToken(null)).resolves.toBeNull();
    await expect(verifyDeviceToken("Basic token")).resolves.toBeNull();
    await expect(verifyDeviceToken("Bearer   ")).resolves.toBeNull();
    expect(boundary.selectWhere).not.toHaveBeenCalled();
  });

  it("resolves the token owner and updates only best-effort last-seen state", async () => {
    boundary.rows = [{ id: "device-current", userId: "user-owner" }];

    await expect(verifyDeviceToken("Bearer correct-token")).resolves.toEqual({
      userId: "user-owner",
      deviceId: "device-current",
    });
    expect(boundary.updateSet).toHaveBeenCalledWith({ lastSeenAt: expect.any(Date) });
  });

  it("rejects an unknown or wrong-device token", async () => {
    boundary.rows = [];

    await expect(verifyDeviceToken("Bearer token-from-another-device")).resolves.toBeNull();
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("rejects a revoked device returned as no active database match", async () => {
    // The database boundary applies revoked_at IS NULL and expires_at > now.
    boundary.rows = [];

    await expect(verifyDeviceToken("Bearer revoked-device-token")).resolves.toBeNull();
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("uses SHA-256 token hashes and never requires the plaintext token in storage", () => {
    const token = "desktop-secret-token";
    expect(hashToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashToken(token)).not.toContain(token);
  });

  it("does not fail authentication if last-seen telemetry cannot be updated", async () => {
    boundary.rows = [{ id: "device-current", userId: "user-owner" }];
    boundary.updateWhere.mockRejectedValue(new Error("database unavailable"));

    await expect(verifyDeviceToken("Bearer correct-token")).resolves.toEqual({
      userId: "user-owner",
      deviceId: "device-current",
    });
  });
});
