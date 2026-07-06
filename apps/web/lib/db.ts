import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Fallback keeps `next build` from failing when DATABASE_URL is absent at
// build time; postgres-js only connects on first query, never at import.
const client = postgres(process.env.DATABASE_URL || "postgres://localhost:5432/placeholder", {
  prepare: false,
});
export const db = drizzle(client, { schema });
