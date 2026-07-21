import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
const output = resolve(root, "dist");

function extensionAssets(): Plugin {
  return {
    name: "thewcag-extension-assets",
    async writeBundle() {
      await mkdir(output, { recursive: true });
      const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as Record<string, unknown>;
      await Promise.all([
        writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
        copyFile(resolve(root, "../web/public/logo.png"), resolve(output, "logo.png")),
      ]);
    },
  };
}

export default defineConfig({
  root,
  plugins: [react(), extensionAssets()],
  build: {
    outDir: output,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(root, "popup.html"),
        sidepanel: resolve(root, "sidepanel.html"),
        "service-worker": resolve(root, "src/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "service-worker" ? "service-worker.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
