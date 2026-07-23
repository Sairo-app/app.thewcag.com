import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const MIGRATION_LOCK = "thewcag_schema_migrations";
const ALIASES_FILE = "migration-aliases.json";

type MigrationAliases = Record<string, string[]>;

let ran = false;

function resolveMigrationDirectory(): string {
  const candidates = [
    join(process.cwd(), "apps", "web", "drizzle"),
    join(process.cwd(), "drizzle"),
  ];
  const directory = candidates.find((candidate) => existsSync(candidate));
  if (!directory) {
    throw new Error(
      `Migration directory not found (checked ${candidates.join(", ")}).`,
    );
  }
  return directory;
}

function readAliases(directory: string): MigrationAliases {
  const path = join(directory, ALIASES_FILE);
  if (!existsSync(path)) return {};

  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${ALIASES_FILE} must contain an object.`);
  }

  const aliases: MigrationAliases = {};
  for (const [name, legacyNames] of Object.entries(value)) {
    if (!name.endsWith(".sql") || !Array.isArray(legacyNames) ||
      legacyNames.some((legacyName) => typeof legacyName !== "string" || !legacyName.endsWith(".sql"))) {
      throw new Error(`${ALIASES_FILE} contains an invalid migration alias.`);
    }
    aliases[name] = legacyNames;
  }
  return aliases;
}

/** Apply every unapplied SQL file and record its canonical filename. */
export async function applyMigrationFiles(databaseUrl: string): Promise<void> {
  const directory = resolveMigrationDirectory();
  const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
  const aliases = readAliases(directory);
  const sql = postgres(databaseUrl, { max: 1 });
  let locked = false;

  try {
    await sql`SELECT pg_advisory_lock(hashtext(${MIGRATION_LOCK}))`;
    locked = true;
    await sql`CREATE TABLE IF NOT EXISTS "_thewcag_migrations" (
      "name" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp DEFAULT now() NOT NULL
    )`;

    const rows = await sql`SELECT "name" FROM "_thewcag_migrations"`;
    const appliedNames = new Set(rows.map((row) => String(row.name)));

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`[migrate] already applied ${file}`);
        continue;
      }

      const legacyName = (aliases[file] ?? []).find((name) => appliedNames.has(name));
      if (legacyName) {
        await sql`INSERT INTO "_thewcag_migrations" ("name") VALUES (${file})
          ON CONFLICT ("name") DO NOTHING`;
        appliedNames.add(file);
        console.log(`[migrate] recorded ${file} (formerly ${legacyName})`);
        continue;
      }

      const text = readFileSync(join(directory, file), "utf8");
      await sql.begin(async (tx) => {
        for (const statement of text.split("--> statement-breakpoint")) {
          const trimmed = statement.trim();
          if (trimmed) await tx.unsafe(trimmed);
        }
        await tx`INSERT INTO "_thewcag_migrations" ("name") VALUES (${file})`;
      });
      appliedNames.add(file);
      console.log(`[migrate] applied ${file}`);
    }
  } finally {
    if (locked) {
      await sql`SELECT pg_advisory_unlock(hashtext(${MIGRATION_LOCK}))`.catch(() => undefined);
    }
    await sql.end();
  }
}

/** Apply the versioned migration files once per process on server startup. */
export async function runMigrations(): Promise<void> {
  if (ran) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production; database migrations cannot run.");
    }
    return;
  }

  ran = true;
  try {
    await applyMigrationFiles(databaseUrl);
    console.log("[migrate] schema ready");
  } catch (error) {
    ran = false;
    const message = error instanceof Error ? error.message || error.name : String(error);
    console.error("[migrate] failed:", message);
    // A production server with an unusable schema is not healthy: auth,
    // reports, and device connections would fail later with less actionable
    // errors. Development stays available for static UI work while the local
    // database is offline.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Database migration failed: ${message}`, { cause: error });
    }
  }
}
