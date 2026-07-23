import { beforeEach, describe, expect, it, vi } from "vitest";

type Condition = { op: string; values?: string[]; conditions?: Condition[] };

const boundary = vi.hoisted(() => ({
  whereConditions: [] as Condition[],
  select: vi.fn(),
}));

vi.mock("drizzle-orm", () => {
  const sql = () => ({ op: "sql" });
  return {
    and: (...conditions: Condition[]) => ({ op: "and", conditions }),
    desc: () => ({ op: "desc" }),
    gt: () => ({ op: "gt" }),
    inArray: (_column: unknown, values: string[]) => ({ op: "in", values }),
    isNull: () => ({ op: "is-null" }),
    sql,
  };
});
vi.mock("@/lib/schema", () => ({
  reports: { userId: "report_user_id", sizeBytes: "size_bytes" },
  desktopDevices: { userId: "device_user_id", revokedAt: "revoked_at", expiresAt: "expires_at" },
  billingSubscriptions: { userId: "subscription_user_id", status: "status", updatedAt: "updated_at" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: boundary.select.mockImplementation(() => ({
      from: () => ({
        where: (condition: Condition) => {
          boundary.whereConditions.push(condition);
          return {
            groupBy: async () => [],
            orderBy: async () => [],
          };
        },
      }),
    })),
  },
}));

import { loadAdminUserDecorations } from "./admin-users";

function inFilter(condition: Condition): Condition | undefined {
  if (condition.op === "in") return condition;
  return condition.conditions?.map(inFilter).find(Boolean);
}

describe("admin user decoration queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.whereConditions = [];
  });

  it("bounds every aggregate query to the paginated user IDs", async () => {
    const userIds = ["user-1", "user-2"];
    await loadAdminUserDecorations(userIds);

    expect(boundary.whereConditions).toHaveLength(3);
    for (const condition of boundary.whereConditions) {
      expect(inFilter(condition)?.values).toEqual(userIds);
    }
  });

  it("does not run decoration queries for an empty page", async () => {
    await expect(loadAdminUserDecorations([])).resolves.toEqual({
      reportAgg: [],
      deviceAgg: [],
      subscriptionRows: [],
    });
    expect(boundary.select).not.toHaveBeenCalled();
  });
});
