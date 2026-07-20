export interface DesktopReleaseAsset {
  name: string;
  browser_download_url: string;
}

function matchesOs(name: string, os: "mac" | "windows"): boolean {
  const normalized = name.toLowerCase();
  if (os === "windows") {
    return /^thewcag-\d+\.\d+\.\d+-win-x64\.exe$/.test(normalized);
  }
  return /^thewcag-\d+\.\d+\.\d+-mac-universal\.dmg$/.test(normalized);
}

export function selectElectronInstaller(
  assets: DesktopReleaseAsset[] | undefined,
  os: "mac" | "windows",
): string | null {
  if (!assets?.length) return null;
  const names = new Set(assets.map((asset) => asset.name.toLowerCase()));
  if (!names.has("latest-mac.yml") || !names.has("latest.yml")) return null;
  return assets.find((asset) => matchesOs(asset.name, os))?.browser_download_url ?? null;
}
