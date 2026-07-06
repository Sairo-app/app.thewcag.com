// Applies drizzle SQL migrations on container startup (idempotent). Runs
// before the server via the Docker CMD so the co-located Postgres is always
// schema-current. Uses postgres.js (a runtime dependency, present in the
// standalone bundle) and reads ./drizzle relative to the working directory.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL not set");
  process.exit(1);
}

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { max: 1 });

try {
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    for (const stmt of text.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
    console.log(`migrate: applied ${file}`);
  }
  console.log("migrate: done");
} catch (e) {
  console.error("migrate: failed", e?.message || e);
  process.exit(1);
} finally {
  await sql.end();
}
