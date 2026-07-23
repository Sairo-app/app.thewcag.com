import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cancelSubscriptions: vi.fn(),
  deleteUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidatePath }));
vi.mock("@/lib/admin", () => ({ requireAdmin: boundary.requireAdmin }));
vi.mock("@/lib/billing/account-deletion", () => ({
  cancelSubscriptionsBeforeAccountDeletion: boundary.cancelSubscriptions,
  deleteUserWithBillingTombstones: boundary.deleteUser,
}));
vi.mock("@/lib/r2", () => ({ deleteImageBestEffort: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/schema", () => ({ reports: { imageKey: "image_key", userId: "user_id", slug: "slug" } }));

import { adminDeleteReport, adminDeleteUser } from "./actions";

describe("admin destructive action results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.requireAdmin.mockResolvedValue({ userId: "admin-user", email: "admin@example.com" });
  });

  it("returns a visible failure when paid-subscription cancellation fails", async () => {
    boundary.cancelSubscriptions.mockRejectedValue(new Error("Dodo unavailable"));

    await expect(adminDeleteUser("customer-user")).resolves.toEqual({
      ok: false,
      reason: "Paid subscription cancellation failed. The user was not deleted.",
    });
    expect(boundary.deleteUser).not.toHaveBeenCalled();
    expect(boundary.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an authorization failure instead of a successful void result", async () => {
    boundary.requireAdmin.mockResolvedValue(null);

    await expect(adminDeleteUser("customer-user")).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("authorization"),
    });
    expect(boundary.cancelSubscriptions).not.toHaveBeenCalled();
    expect(boundary.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unauthorized report deletion without revalidating", async () => {
    boundary.requireAdmin.mockResolvedValue(null);

    await expect(adminDeleteReport("AbCdEf1234")).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("authorization"),
    });
    expect(boundary.revalidatePath).not.toHaveBeenCalled();
  });
});
