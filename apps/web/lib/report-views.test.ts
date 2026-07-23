import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  inserted: [] as Array<{ reportSlug: string }>,
  values: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/schema", () => ({
  reports: { slug: "slug", viewCount: "view_count" },
  reportViews: { reportSlug: "report_slug" },
}));

vi.mock("@/lib/db", () => {
  const tx = {
    insert: vi.fn(() => ({
      values: (value: unknown) => {
        boundary.values(value);
        return {
          onConflictDoNothing: () => ({
            returning: async () => boundary.inserted,
          }),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (value: unknown) => {
        boundary.updateSet(value);
        return { where: boundary.updateWhere };
      },
    })),
  };
  return { db: { transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } };
});

import { recordUniqueReportView } from "./report-views";

describe("report view deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.inserted = [];
  });

  it("increments only when the report/IP/day reservation is new", async () => {
    boundary.inserted = [{ reportSlug: "AbCdEf1234" }];
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });

    await expect(recordUniqueReportView(
      "AbCdEf1234",
      headers,
      new Date("2026-07-23T12:00:00.000Z"),
    )).resolves.toBe(true);
    expect(boundary.updateSet).toHaveBeenCalledTimes(1);
    expect(boundary.values).toHaveBeenCalledWith(expect.objectContaining({
      reportSlug: "AbCdEf1234",
      viewedOn: "2026-07-23",
      visitorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));

    boundary.inserted = [];
    await expect(recordUniqueReportView(
      "AbCdEf1234",
      headers,
      new Date("2026-07-23T18:00:00.000Z"),
    )).resolves.toBe(false);
    expect(boundary.updateSet).toHaveBeenCalledTimes(1);
  });
});
