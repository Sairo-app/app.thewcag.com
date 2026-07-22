import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  getImage: vi.fn(),
  isReportAvailable: vi.fn(),
  reportRows: [] as Array<{
    imageKey: string;
    contentType: string;
    availabilityStatus: string;
    graceEndsAt: Date | null;
  }>,
}));

vi.mock("@/lib/r2", () => ({ getImage: boundary.getImage }));
vi.mock("@/lib/billing/subscriptions", () => ({
  isReportAvailable: boundary.isReportAvailable,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => boundary.reportRows }),
      }),
    })),
  },
}));

import { GET } from "./route";

const CONTEXT = { params: Promise.resolve({ slug: "AbCdEf1234" }) };

describe("public report image route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.isReportAvailable.mockReturnValue(true);
    boundary.reportRows = [{
      imageKey: "screenshots/AbCdEf1234.png",
      contentType: "image/png",
      availabilityStatus: "active",
      graceEndsAt: null,
    }];
    boundary.getImage.mockResolvedValue({
      body: new Uint8Array([137, 80, 78, 71]),
      contentType: "image/png",
    });
  });

  it("streams an available private R2 object through the checked route", async () => {
    const response = await GET(new Request("https://app.thewcag.com/api/s/AbCdEf1234/image"), CONTEXT);

    expect(response.status).toBe(200);
    expect(boundary.getImage).toHaveBeenCalledWith("screenshots/AbCdEf1234.png");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("never reads R2 for a missing or unavailable report", async () => {
    boundary.reportRows = [];
    expect((await GET(new Request("https://app.thewcag.com"), CONTEXT)).status).toBe(404);

    boundary.reportRows = [{
      imageKey: "screenshots/AbCdEf1234.png",
      contentType: "image/png",
      availabilityStatus: "disabled",
      graceEndsAt: null,
    }];
    boundary.isReportAvailable.mockReturnValue(false);
    expect((await GET(new Request("https://app.thewcag.com"), CONTEXT)).status).toBe(410);
    expect(boundary.getImage).not.toHaveBeenCalled();
  });

  it("returns not found when the mocked R2 boundary has no object", async () => {
    boundary.getImage.mockResolvedValue(null);

    const response = await GET(new Request("https://app.thewcag.com"), CONTEXT);

    expect(response.status).toBe(404);
  });
});
