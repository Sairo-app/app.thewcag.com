// Runs once when the Next server process starts (Node runtime only).
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

export function assertProductionDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
): void {
  const productionRuntime =
    environment.NODE_ENV === "production" &&
    environment.NEXT_PHASE !== NEXT_PRODUCTION_BUILD_PHASE;
  if (productionRuntime && !environment.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is required in production; refusing to start the web server.",
    );
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      assertProductionDatabaseUrl();
      const { siteUrlFromEnvironment } = await import("./lib/seo");
      siteUrlFromEnvironment();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[startup] ${message}`);
      process.exit(1);
    }
  }
  const { validateLiveBillingConfiguration } = await import("./lib/billing/plans");
  validateLiveBillingConfiguration();
  const startupMigrationEnabled =
    process.env.NODE_ENV !== "production" || process.env.RUN_STARTUP_MIGRATIONS === "true";
  if (process.env.NEXT_RUNTIME === "nodejs" && startupMigrationEnabled) {
    const { runMigrations } = await import("./lib/migrate");
    await runMigrations();
  }
}
