import { access, cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function empty(path: string): Promise<boolean> {
  return readdir(path).then((entries) => entries.length === 0).catch(() => true);
}

export async function migrateLegacyDesktopData(appData: string, userData: string): Promise<void> {
  const marker = join(userData, ".electron-migration-complete");
  if (await access(marker).then(() => true).catch(() => false)) return;
  const candidates = [
    join(appData, "com.thewcag.app"),
    join(appData, "TheWCAG"),
  ];
  await mkdir(userData, { recursive: true });
  for (const source of candidates) {
    const storeSource = join(source, "store");
    const capturesSource = join(source, "captures");
    if (await empty(join(userData, "store"))) {
      await cp(storeSource, join(userData, "store"), { recursive: true, force: false }).catch(() => undefined);
    }
    if (await empty(join(userData, "captures"))) {
      await cp(capturesSource, join(userData, "captures"), { recursive: true, force: false }).catch(() => undefined);
    }
  }
  await writeFile(marker, new Date().toISOString(), { mode: 0o600 });
}
