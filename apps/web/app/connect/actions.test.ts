import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  auth: vi.fn(),
  createDeviceClaim: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: boundary.auth }));
vi.mock("@/lib/device-claim", () => ({ createDeviceClaim: boundary.createDeviceClaim }));

import { authorizeDevice } from "./actions";

const STATE = "0123456789abcdef0123456789abcdef";
const CODE = "a".repeat(64);

describe("browser device authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.auth.mockResolvedValue({ user: { id: "user-owner" } });
    boundary.createDeviceClaim.mockResolvedValue(CODE);
  });

  it("returns a one-time code without minting a bearer token", async () => {
    const deepLink = await authorizeDevice(STATE, "  QA\nDesktop  ");
    const url = new URL(deepLink);

    expect(url.protocol).toBe("thewcag:");
    expect(url.hostname).toBe("auth");
    expect(url.searchParams.get("code")).toBe(CODE);
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.has("token")).toBe(false);
    expect(boundary.createDeviceClaim).toHaveBeenCalledWith("user-owner", "QA Desktop");
  });

  it("rejects invalid state before creating a pending row", async () => {
    await expect(authorizeDevice("short", "Desktop")).rejects.toThrow("Invalid connection request");
    expect(boundary.createDeviceClaim).not.toHaveBeenCalled();
  });
});
