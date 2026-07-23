import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const buildOrNonProductionFallbackAllowed =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NODE_ENV !== "production";
if (!configuredDatabaseUrl && !buildOrNonProductionFallbackAllowed) {
  throw new Error(
    "DATABASE_URL is required in production; refusing to initialize the database client.",
  );
}
// postgres-js connects lazily. The placeholder supports Next's production
// build and non-production tooling, but never a production server runtime.
const client = postgres(configuredDatabaseUrl || "postgres://localhost:5432/placeholder", {
  prepare: false,
});
export const db = drizzle(client, { schema });
