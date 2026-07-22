// Applies drizzle SQL migrations on container startup (idempotent). Runs
// before the server via the Docker CMD so the co-located Postgres is always
// schema-current. Uses postgres.js (a runtime dependency, present in the
// standalone bundle) and reads ./drizzle relative to the working directory.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL not set");
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { max: 1 });

try {
  await sql`SELECT pg_advisory_lock(hashtext('thewcag_schema_migrations'))`;
  await sql`CREATE TABLE IF NOT EXISTS "_thewcag_migrations" (
    "name" text PRIMARY KEY NOT NULL,
    "applied_at" timestamp DEFAULT now() NOT NULL
  )`;
  for (const file of files) {
    const [applied] = await sql`SELECT "name" FROM "_thewcag_migrations" WHERE "name" = ${file} LIMIT 1`;
    if (applied) {
      console.log(`migrate: already applied ${file}`);
      continue;
    }
    const text = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      for (const stmt of text.split("--> statement-breakpoint")) {
        const trimmed = stmt.trim();
        if (trimmed) await tx.unsafe(trimmed);
      }
      await tx`INSERT INTO "_thewcag_migrations" ("name") VALUES (${file})`;
    });
    console.log(`migrate: applied ${file}`);
  }
  console.log("migrate: done");
} catch (e) {
  console.error("migrate: failed", e?.message || e);
  process.exit(1);
} finally {
  await sql`SELECT pg_advisory_unlock(hashtext('thewcag_schema_migrations'))`.catch(() => undefined);
  await sql.end();
}
