import { describe, expect, it } from "vitest";
import { assertProductionDatabaseUrl } from "./instrumentation";

describe("production database startup configuration", () => {
  it("rejects a production server without DATABASE_URL", () => {
    expect(() => assertProductionDatabaseUrl({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL is required in production; refusing to start the web server.",
    );
  });

  it("allows a production Next build to use the lazy placeholder", () => {
    expect(() => assertProductionDatabaseUrl({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    })).not.toThrow();
  });

  it("accepts a configured production server", () => {
    expect(() => assertProductionDatabaseUrl({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://db.example.test/thewcag",
    })).not.toThrow();
  });
});
