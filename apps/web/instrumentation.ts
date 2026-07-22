// Runs once when the Next server process starts (Node runtime only).
export async function register() {
  const { validateLiveBillingConfiguration } = await import("./lib/billing/plans");
  validateLiveBillingConfiguration();
  const startupMigrationEnabled =
    process.env.NODE_ENV !== "production" || process.env.RUN_STARTUP_MIGRATIONS === "true";
  if (process.env.NEXT_RUNTIME === "nodejs" && startupMigrationEnabled) {
    const { runMigrations } = await import("./lib/migrate");
    await runMigrations();
  }
}
