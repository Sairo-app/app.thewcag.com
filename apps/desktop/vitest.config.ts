import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["electron/**/*.test.ts", "src/app/**/*.test.ts"],
    coverage: { reporter: ["text", "json-summary"] },
  },
});
