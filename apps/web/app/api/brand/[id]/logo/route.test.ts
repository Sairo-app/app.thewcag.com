import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  condition: null as null | { column: string; value: string },
  rows: [] as Array<{ key: string | null }>,
  getImage: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: string, value: string) => ({ column, value }),
}));
vi.mock("@/lib/schema", () => ({
  users: {
    id: "user_id",
    brandAssetToken: "brand_asset_token",
    brandLogoKey: "brand_logo_key",
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: { column: string; value: string }) => {
          boundary.condition = condition;
          return { limit: async () => boundary.rows };
        },
      }),
    }),
  },
}));
vi.mock("@/lib/r2", () => ({ getImage: boundary.getImage }));

import { GET } from "./route";

describe("public brand logo assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.condition = null;
    boundary.rows = [{ key: "brand/logo.png" }];
    boundary.getImage.mockResolvedValue({
      body: Buffer.from("logo"),
      contentType: "image/png",
    });
  });

  it("resolves new logo URLs through the opaque asset token", async () => {
    const token = "br_0123456789abcdef0123456789abcdef";
    const response = await GET(new Request("https://app.thewcag.com"), {
      params: Promise.resolve({ id: token }),
    });

    expect(response.status).toBe(200);
    expect(boundary.condition).toEqual({ column: "brand_asset_token", value: token });
  });

  it("keeps legacy user-ID URLs readable without consulting subscription status", async () => {
    const legacyId = "72f3c21a-a5a5-4f08-a2ae-f790448519e7";
    const response = await GET(new Request("https://app.thewcag.com"), {
      params: Promise.resolve({ id: legacyId }),
    });

    expect(response.status).toBe(200);
    expect(boundary.condition).toEqual({ column: "user_id", value: legacyId });
  });
});
