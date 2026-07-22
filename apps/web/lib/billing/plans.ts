export type BillingInterval = "month" | "year";
export type PlanChoice = "pro-monthly" | "pro-annual";
export type PlanKey = "pro";

export interface PlanCatalogEntry {
  choice: PlanChoice;
  planKey: PlanKey;
  interval: BillingInterval;
  productId: string;
}

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export function managedAiPeriodLimit(): number {
  return positiveInteger(process.env.PRO_AI_GENERATIONS_PER_PERIOD, 150, 100_000);
}

export function managedAiHourlyLimit(): number {
  return positiveInteger(process.env.PRO_AI_GENERATIONS_PER_HOUR, 20, 2_000);
}

export function hostedReportLimit(): number {
  return positiveInteger(process.env.PRO_HOSTED_REPORT_LIMIT, 100, 100_000);
}

export function hostedStorageQuotaBytes(): number {
  return positiveInteger(process.env.PRO_STORAGE_QUOTA_BYTES, 1024 * 1024 * 1024, 1024 ** 4);
}

export function publicPrice(interval: BillingInterval): number {
  const key = interval === "month" ? "NEXT_PUBLIC_PRO_MONTHLY_PRICE_USD" : "NEXT_PUBLIC_PRO_ANNUAL_PRICE_USD";
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.round(parsed * 100) / 100, 100_000)
    : interval === "month" ? 19 : 190;
}

export function planCatalog(): PlanCatalogEntry[] {
  const monthly = process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim() || "";
  const annual = process.env.DODO_PRO_ANNUAL_PRODUCT_ID?.trim() || "";
  return [
    { choice: "pro-monthly", planKey: "pro", interval: "month", productId: monthly },
    { choice: "pro-annual", planKey: "pro", interval: "year", productId: annual },
  ];
}

export function configuredPlanCatalog(): PlanCatalogEntry[] {
  return planCatalog().filter((entry) => Boolean(entry.productId));
}

export function planForChoice(choice: unknown): PlanCatalogEntry | null {
  if (choice !== "pro-monthly" && choice !== "pro-annual") return null;
  return planCatalog().find((entry) => entry.choice === choice && entry.productId) ?? null;
}

export function planForProduct(productId: unknown): PlanCatalogEntry | null {
  if (typeof productId !== "string" || !productId) return null;
  return configuredPlanCatalog().find((entry) => entry.productId === productId) ?? null;
}

export function billingConfigured(): boolean {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY?.trim()
    && process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim()
    && process.env.DODO_PAYMENTS_BUSINESS_ID?.trim()
    && process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim()
    && process.env.DODO_PRO_ANNUAL_PRODUCT_ID?.trim(),
  );
}

export function billingEnvironment(): "test_mode" | "live_mode" {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode" ? "test_mode" : "live_mode";
}

export function validateLiveBillingConfiguration(): void {
  if (process.env.NODE_ENV !== "production") return;
  try {
    const site = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com");
    if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash) throw new Error("invalid origin");
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a canonical HTTPS origin in production.");
  }
  if (process.env.R2_PUBLIC_URL?.trim()) {
    throw new Error("R2_PUBLIC_URL is not supported. Hosted report storage must remain private.");
  }
  const anyDodoValue = Object.keys(process.env).some((key) => key.startsWith("DODO_") && Boolean(process.env[key]));
  if (!anyDodoValue) return;
  if (!billingConfigured()) {
    throw new Error("Dodo Payments is partially configured. Set the API key, webhook key, business ID, and both Pro product IDs.");
  }
  if (billingEnvironment() !== "live_mode") {
    throw new Error("Production Dodo Payments configuration must use live_mode.");
  }
  if (process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim() === process.env.DODO_PRO_ANNUAL_PRODUCT_ID?.trim()) {
    throw new Error("Monthly and annual Dodo product IDs must be different.");
  }
  if ((process.env.BILLING_RECONCILE_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("BILLING_RECONCILE_SECRET must contain at least 32 characters in production.");
  }
}

export function expectedDodoBusinessId(): string {
  const value = process.env.DODO_PAYMENTS_BUSINESS_ID?.trim();
  if (!value) throw new Error("Dodo Payments business ID is not configured");
  return value;
}
