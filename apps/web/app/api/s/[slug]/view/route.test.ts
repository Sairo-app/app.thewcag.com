import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  auth: vi.fn(),
  hasActiveProSubscription: vi.fn(),
  isReportAvailable: vi.fn(),
  reportRows: [] as Array<{ userId: string; availabilityStatus: string; graceEndsAt: Date | null }>,
  selectWhere: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: boundary.auth }));
vi.mock("@/lib/billing/entitlements", () => ({
  hasActiveProSubscription: boundary.hasActiveProSubscription,
}));
vi.mock("@/lib/billing/subscriptions", () => ({
  isReportAvailable: boundary.isReportAvailable,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: (condition: unknown) => {
          boundary.selectWhere(condition);
          return { limit: async () => boundary.reportRows };
        },
      }),
    })),
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

import { POST } from "./route";

const SLUG = "AbCdEf1234";

function request({ cookie = "", userAgent = "Mozilla/5.0" } = {}) {
  return new NextRequest(`https://app.thewcag.com/api/s/${SLUG}/view`, {
    method: "POST",
    headers: {
      "user-agent": userAgent,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function context(slug = SLUG) {
  return { params: Promise.resolve({ slug }) };
}

describe("public report view counting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.auth.mockResolvedValue(null);
    boundary.hasActiveProSubscription.mockResolvedValue(true);
    boundary.isReportAvailable.mockReturnValue(true);
    boundary.reportRows = [{
      userId: "report-owner",
      availabilityStatus: "active",
      graceEndsAt: null,
    }];
  });

  it("counts an unauthenticated human view once and sets a deduplication cookie", async () => {
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counted: true });
    expect(boundary.updateSet).toHaveBeenCalledTimes(1);
    expect(boundary.updateSet).toHaveBeenCalledWith({ viewCount: expect.anything() });
    expect(boundary.hasActiveProSubscription).toHaveBeenCalledWith("report-owner");
    expect(response.headers.get("set-cookie")).toContain(`tw_report_${SLUG}=1`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("does not recount a browser carrying the report cookie", async () => {
    const response = await POST(
      request({ cookie: `tw_report_${SLUG}=1` }),
      context(),
    );

    await expect(response.json()).resolves.toEqual({ counted: false });
    expect(boundary.selectWhere).not.toHaveBeenCalled();
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("does not count the report owner", async () => {
    boundary.auth.mockResolvedValue({ user: { id: "report-owner" } });

    const response = await POST(request(), context());

    await expect(response.json()).resolves.toEqual({ counted: false });
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("does not count bots or previews", async () => {
    const response = await POST(
      request({ userAgent: "facebookexternalhit/1.1 preview" }),
      context(),
    );

    await expect(response.json()).resolves.toEqual({ counted: false });
    expect(boundary.selectWhere).not.toHaveBeenCalled();
  });

  it("does not count when report analytics are not entitled", async () => {
    boundary.hasActiveProSubscription.mockResolvedValue(false);

    const response = await POST(request(), context());

    await expect(response.json()).resolves.toEqual({ counted: false, analytics: false });
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("returns not found and gone states without updating the counter", async () => {
    boundary.reportRows = [];
    expect((await POST(request(), context())).status).toBe(404);

    boundary.reportRows = [{
      userId: "report-owner",
      availabilityStatus: "disabled",
      graceEndsAt: null,
    }];
    boundary.isReportAvailable.mockReturnValue(false);
    expect((await POST(request(), context())).status).toBe(410);
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("rejects malformed slugs before any report lookup", async () => {
    const response = await POST(request(), context("invalid"));

    expect(response.status).toBe(400);
    expect(boundary.selectWhere).not.toHaveBeenCalled();
  });
});
