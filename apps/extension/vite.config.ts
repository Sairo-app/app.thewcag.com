import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import sharp from "sharp";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
const output = resolve(root, "dist");
export const EXTENSION_ICON_SIZES = [16, 32, 48, 128] as const;

export async function writeExtensionAssets(outputDirectory = output): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as Record<string, unknown>;
  const logoPath = resolve(root, "../web/public/logo.png");
  await Promise.all([
    writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    copyFile(logoPath, resolve(outputDirectory, "logo.png")),
    ...EXTENSION_ICON_SIZES.map((size) => sharp(logoPath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(resolve(outputDirectory, `icon-${size}.png`))),
  ]);
}

function extensionAssets(): Plugin {
  return {
    name: "thewcag-extension-assets",
    async writeBundle() {
      await writeExtensionAssets();
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
