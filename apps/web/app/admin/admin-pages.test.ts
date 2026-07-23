import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  select: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ requireAdmin: boundary.requireAdmin }));
vi.mock("next/navigation", () => ({
  notFound: boundary.notFound,
  redirect: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { select: boundary.select } }));
vi.mock("@/app/admin/actions", () => ({
  adminDeleteReport: vi.fn(),
  adminDeleteUser: vi.fn(),
}));
vi.mock("@/lib/admin-users", () => ({ loadAdminUserDecorations: vi.fn() }));

import AdminOverview from "./page";
import AdminReports from "./reports/page";
import AdminUsers from "./users/page";

describe("admin page authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.requireAdmin.mockResolvedValue(null);
  });

  it.each([
    ["overview", () => AdminOverview()],
    ["reports", () => AdminReports({ searchParams: Promise.resolve({}) })],
    ["users", () => AdminUsers({ searchParams: Promise.resolve({}) })],
  ])("rejects non-admin direct access to %s before querying", async (_name, render) => {
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(boundary.requireAdmin).toHaveBeenCalledTimes(1);
    expect(boundary.select).not.toHaveBeenCalled();
  });
});
