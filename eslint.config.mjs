import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/out/**",
      "**/release/**",
      "apps/desktop/src/vite-env.d.ts",
      "apps/web/next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    plugins: {
      // Next's build-time lint detector calculates the config for this file
      // itself, so expose the plugin globally while keeping its rules scoped
      // to the web application below.
      "@next/next": next,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "react-hooks/rules-of-hooks": "error",
      // Effects in the desktop renderer intentionally subscribe by audit/window
      // identity while reading the latest render closure. Rules-of-hooks remains
      // enforced, but dependency policy is reviewed in code and tests.
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: [
      "apps/web/**/*.{js,mjs,ts,tsx}",
      "app/**/*.{js,mjs,ts,tsx}",
      "components/**/*.{js,mjs,ts,tsx}",
      "lib/**/*.{js,mjs,ts,tsx}",
    ],
    plugins: {
      react,
    },
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
