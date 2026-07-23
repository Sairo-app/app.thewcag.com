import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { applyMigrationFiles } from "./migrate";
import { claimDevice, createDeviceClaim, MAX_ACTIVE_DEVICES } from "./device-claim";
import { hashToken } from "./device-auth";
import { desktopDevices, users } from "./schema";
import * as schema from "./schema";
import { db as applicationDatabase } from "./db";

const baseDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const integrationDescribe = baseDatabaseUrl ? describe : describe.skip;
const USER_ID = "device-claim-test-user";
const START = new Date("2026-07-23T00:00:00.000Z");

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

integrationDescribe("device claim exchange", () => {
  const databaseName = `thewcag_claim_${process.pid}_${Date.now().toString(36)}`;
  const databaseUrl = baseDatabaseUrl ? urlForDatabase(baseDatabaseUrl, databaseName) : "";
  let client: ReturnType<typeof postgres>;
  let database: typeof applicationDatabase;

  beforeAll(async () => {
    const admin = postgres(baseDatabaseUrl!, { max: 1 });
    try {
      await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    } finally {
      await admin.end();
    }
    await applyMigrationFiles(databaseUrl);
    client = postgres(databaseUrl, { max: 1 });
    database = drizzle(client, { schema }) as typeof applicationDatabase;
    await database.insert(users).values({ id: USER_ID, email: "claim-test@example.test" });
  }, 60_000);

  beforeEach(async () => {
    await database.delete(desktopDevices).where(eq(desktopDevices.userId, USER_ID));
  });

  afterAll(async () => {
    if (client) await client.end();
    if (!baseDatabaseUrl) return;
    const admin = postgres(baseDatabaseUrl, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  });

  it("activates a pending row only when the code is claimed", async () => {
    const code = await createDeviceClaim(USER_ID, "Claim test desktop", { now: START, database });
    const [pending] = await database.select().from(desktopDevices);
    expect(pending).toMatchObject({ tokenHash: null, claimedAt: null, expiresAt: null });

    const result = await claimDevice(code, { now: START, database });

    expect(result.status).toBe("claimed");
    if (result.status !== "claimed") throw new Error("Expected the claim to succeed");
    const [claimed] = await database.select().from(desktopDevices);
    expect(claimed.claimedAt).toEqual(START);
    expect(claimed.expiresAt).toEqual(result.expiresAt);
    expect(claimed.tokenHash).toBe(hashToken(result.token));
  });

  it("rejects an expired code without activating the row", async () => {
    const code = await createDeviceClaim(USER_ID, "Expired desktop", { now: START, database });
    const afterExpiry = new Date(START.getTime() + 10 * 60 * 1_000);

    await expect(claimDevice(code, { now: afterExpiry, database })).resolves.toEqual({ status: "expired" });
    const [pending] = await database.select().from(desktopDevices);
    expect(pending).toMatchObject({ tokenHash: null, claimedAt: null, expiresAt: null });
  });

  it("rejects a replayed code", async () => {
    const code = await createDeviceClaim(USER_ID, "Replay desktop", { now: START, database });
    await expect(claimDevice(code, { now: START, database })).resolves.toMatchObject({ status: "claimed" });

    await expect(claimDevice(code, {
      now: new Date(START.getTime() + 1_000),
      database,
    })).resolves.toEqual({ status: "replayed" });
  });

  it("counts and evicts only claimed devices", async () => {
    const expiresAt = new Date(START.getTime() + 24 * 60 * 60 * 1_000);
    await database.insert(desktopDevices).values([
      ...Array.from({ length: MAX_ACTIVE_DEVICES }, (_, index) => ({
        id: `claimed-${index}`,
        userId: USER_ID,
        tokenHash: hashToken(`claimed-token-${index}`),
        deviceName: `Claimed ${index}`,
        createdAt: new Date(START.getTime() + index * 1_000),
        claimedAt: new Date(START.getTime() + index * 1_000),
        expiresAt,
      })),
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `pending-${index}`,
        userId: USER_ID,
        tokenHash: null,
        claimCodeHash: hashToken(`pending-code-${index}`),
        claimExpiresAt: expiresAt,
        deviceName: `Pending ${index}`,
        createdAt: new Date(START.getTime() + index * 1_000),
        claimedAt: null,
        expiresAt: null,
      })),
    ]);
    const code = await createDeviceClaim(USER_ID, "Newest claimed desktop", {
      now: new Date(START.getTime() + 60_000),
      database,
    });

    await expect(claimDevice(code, {
      now: new Date(START.getTime() + 60_000),
      database,
    })).resolves.toMatchObject({ status: "claimed" });

    const rows = await database.select().from(desktopDevices);
    const activeClaimed = rows.filter((row) => row.claimedAt && !row.revokedAt);
    const pendingRows = rows.filter((row) => !row.claimedAt);
    expect(activeClaimed).toHaveLength(MAX_ACTIVE_DEVICES);
    expect(rows.find((row) => row.id === "claimed-0")?.revokedAt).toEqual(new Date(START.getTime() + 60_000));
    expect(pendingRows).toHaveLength(20);
    expect(pendingRows.every((row) => row.revokedAt === null)).toBe(true);
  });
});
