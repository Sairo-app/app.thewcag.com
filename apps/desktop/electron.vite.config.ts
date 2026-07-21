import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// These workspace packages publish TypeScript source for development. They must
// be compiled into Electron's bundles instead of being loaded from node_modules
// by the packaged app, where Node does not support TypeScript type stripping.
const bundledWorkspacePackages = [
  "@accessibility-build/a11y-core",
  "@accessibility-build/audit-contracts",
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundledWorkspacePackages })],
    build: {
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, "electron/main.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundledWorkspacePackages })],
    build: {
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, "electron/preload.ts") },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: import.meta.dirname,
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: resolve(import.meta.dirname, "index.html"),
      },
    },
  },
});
