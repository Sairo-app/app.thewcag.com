// Runs once when the Next server process starts (Node runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/migrate");
    await runMigrations();
  }
}
