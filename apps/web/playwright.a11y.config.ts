import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/a11y",
  testMatch: "**/*.a11y.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "playwright-a11y-report" }]] : "line",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  expect: { timeout: 10_000 },
  timeout: 45_000,
  webServer: {
    command: "pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ACCESSIBILITY_SCAN_FIXTURE: "1",
      NEXT_PUBLIC_APP_URL: "https://app.thewcag.com",
      AUTH_TRUST_HOST: "true",
      RUN_STARTUP_MIGRATIONS: "false",
      R2_PUBLIC_URL: "",
      DODO_PAYMENTS_API_KEY: "",
      DODO_PAYMENTS_WEBHOOK_KEY: "",
      DODO_PAYMENTS_BUSINESS_ID: "",
      DODO_PRO_MONTHLY_PRODUCT_ID: "",
      DODO_PRO_ANNUAL_PRODUCT_ID: "",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile-320",
      use: {
        viewport: { width: 320, height: 800 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "forced-colors",
      use: {
        viewport: { width: 1440, height: 1000 },
        contextOptions: { forcedColors: "active" },
      },
    },
    {
      name: "reduced-motion",
      use: {
        viewport: { width: 1440, height: 1000 },
        contextOptions: { reducedMotion: "reduce" },
      },
    },
  ],
});
