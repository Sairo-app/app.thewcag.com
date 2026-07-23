import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import postgres from "postgres";
import { expect, it } from "vitest";
import { isFindingId } from "@accessibility-build/audit-contracts";
import { applyMigrationFiles } from "./migrate";

const execFileAsync = promisify(execFile);
const scratchDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const integrationTest = scratchDatabaseUrl ? it : it.skip;
const renamedMigrations = [
  ["0003_finding_identity.sql", "0002_finding_identity.sql"],
  ["0004_brand_and_report_size.sql", "0003_brand_and_report_size.sql"],
  ["0005_dodo_billing.sql", "0004_dodo_billing.sql"],
  ["0006_funnel_telemetry.sql", "0005_funnel_telemetry.sql"],
] as const;

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function publicTables(databaseUrl: string): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    return rows.map((row) => String(row.table_name));
  } finally {
    await sql.end();
  }
}

async function replaceCanonicalJournalNames(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    for (const [canonical, legacy] of renamedMigrations) {
      await sql`UPDATE "_thewcag_migrations" SET "name" = ${legacy} WHERE "name" = ${canonical}`;
    }
  } finally {
    await sql.end();
  }
}

async function migrationNames(databaseUrl: string): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql`SELECT "name" FROM "_thewcag_migrations" ORDER BY "name"`;
    return rows.map((row) => String(row.name));
  } finally {
    await sql.end();
  }
}

async function seedLegacyReport(databaseUrl: string, suffix: string): Promise<string> {
  const sql = postgres(databaseUrl, { max: 1 });
  const userId = `legacy-user-${suffix}`;
  const reportId = `legacy-report-${suffix}`;
  try {
    await sql`INSERT INTO "user" ("id", "email") VALUES (${userId}, ${`${userId}@example.com`})`;
    await sql`INSERT INTO "report" (
      "id", "slug", "user_id", "title", "issues", "image_key", "created_at"
    ) VALUES (
      ${reportId}, ${`legacy-${suffix}`}, ${userId}, 'Legacy report',
      ${sql.json([
        { n: 1, label: "Missing identity", severity: "major", note: "" },
        { n: 2, id: "invalid-id", label: "Invalid identity", severity: "minor", note: "" },
      ])},
      ${`screenshots/legacy-${suffix}.png`},
      '2025-02-03T00:00:00.000Z'
    )`;
    await sql`DELETE FROM "_thewcag_migrations" WHERE "name" = '0008_legacy_report_finding_ids.sql'`;
    return reportId;
  } finally {
    await sql.end();
  }
}

async function legacyIdentityState(databaseUrl: string, reportId: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [report] = await sql`SELECT "issues" FROM "report" WHERE "id" = ${reportId}`;
    const ids = (report.issues as Array<{ id?: unknown }>).map((issue) => issue.id);
    const ledger = await sql`SELECT "id" FROM "finding_identity"`;
    const registered = new Set(ledger.map((row) => String(row.id)));
    return { ids, registered };
  } finally {
    await sql.end();
  }
}

async function replayLegacyBackfill(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`DELETE FROM "_thewcag_migrations" WHERE "name" = '0008_legacy_report_finding_ids.sql'`;
  } finally {
    await sql.end();
  }
}

integrationTest("startup and deploy migration paths create identical tables", async () => {
  const baseUrl = scratchDatabaseUrl!;
  const suffix = `${process.pid}_${Date.now().toString(36)}`;
  const startupDatabase = `thewcag_startup_${suffix}`;
  const deployDatabase = `thewcag_deploy_${suffix}`;
  const startupUrl = urlForDatabase(baseUrl, startupDatabase);
  const deployUrl = urlForDatabase(baseUrl, deployDatabase);
  const admin = postgres(baseUrl, { max: 1 });

  try {
    await admin.unsafe(`CREATE DATABASE "${startupDatabase}"`);
    await admin.unsafe(`CREATE DATABASE "${deployDatabase}"`);

    await applyMigrationFiles(startupUrl);

    const webRoot = fileURLToPath(new URL("../", import.meta.url));
    await execFileAsync(process.execPath, [join(webRoot, "scripts", "migrate.mjs")], {
      cwd: webRoot,
      env: { ...process.env, DATABASE_URL: deployUrl },
    });

    const startupTables = await publicTables(startupUrl);
    const deployTables = await publicTables(deployUrl);
    expect(startupTables).toContain("funnel_transition");
    expect(startupTables).toContain("report_view");
    expect(startupTables).toContain("auth_signin_attempt");
    expect(startupTables).toEqual(deployTables);

    // Simulate databases whose journal still contains the pre-renumbering
    // filenames. Both executors must adopt the canonical names without
    // treating the renamed SQL files as new migrations.
    await replaceCanonicalJournalNames(startupUrl);
    await replaceCanonicalJournalNames(deployUrl);
    await applyMigrationFiles(startupUrl);
    await execFileAsync(process.execPath, [join(webRoot, "scripts", "migrate.mjs")], {
      cwd: webRoot,
      env: { ...process.env, DATABASE_URL: deployUrl },
    });

    const canonicalNames = renamedMigrations.map(([canonical]) => canonical);
    expect(await migrationNames(startupUrl)).toEqual(expect.arrayContaining(canonicalNames));
    expect(await migrationNames(deployUrl)).toEqual(expect.arrayContaining(canonicalNames));

    // Exercise the one-time JSONB backfill through both migration executors.
    const startupReportId = await seedLegacyReport(startupUrl, `startup-${suffix}`);
    const deployReportId = await seedLegacyReport(deployUrl, `deploy-${suffix}`);
    await applyMigrationFiles(startupUrl);
    await execFileAsync(process.execPath, [join(webRoot, "scripts", "migrate.mjs")], {
      cwd: webRoot,
      env: { ...process.env, DATABASE_URL: deployUrl },
    });

    const startupBackfill = await legacyIdentityState(startupUrl, startupReportId);
    const deployBackfill = await legacyIdentityState(deployUrl, deployReportId);
    for (const state of [startupBackfill, deployBackfill]) {
      expect(state.ids).toHaveLength(2);
      expect(state.ids.every(isFindingId)).toBe(true);
      expect(new Set(state.ids).size).toBe(2);
      expect(state.ids.every((id) => state.registered.has(String(id)))).toBe(true);
    }

    // Replaying the migration registers existing IDs but never replaces them.
    await replayLegacyBackfill(startupUrl);
    await replayLegacyBackfill(deployUrl);
    await applyMigrationFiles(startupUrl);
    await execFileAsync(process.execPath, [join(webRoot, "scripts", "migrate.mjs")], {
      cwd: webRoot,
      env: { ...process.env, DATABASE_URL: deployUrl },
    });
    expect((await legacyIdentityState(startupUrl, startupReportId)).ids).toEqual(startupBackfill.ids);
    expect((await legacyIdentityState(deployUrl, deployReportId)).ids).toEqual(deployBackfill.ids);
  } finally {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${startupDatabase}" WITH (FORCE)`).catch(() => undefined);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${deployDatabase}" WITH (FORCE)`).catch(() => undefined);
    await admin.end();
  }
}, 90_000);
