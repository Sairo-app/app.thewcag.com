import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // cache the resolved asset for 5 minutes

const REPO = "Sairo-app/app.thewcag.com";
const RELEASES = "https://github.com/Sairo-app/app.thewcag.com/releases/latest";

/**
 * Stable "download the latest macOS app" link. Resolves the newest GitHub
 * release and 302-redirects to its .dmg asset, so marketing links never
 * hardcode a version. Falls back to the releases page if the API is rate
 * limited or no asset is found.
 */
export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "thewcag-web", Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as { assets?: { name: string; browser_download_url: string }[] };
      const dmg = data.assets?.find((a) => a.name.endsWith(".dmg"));
      if (dmg) return NextResponse.redirect(dmg.browser_download_url, 302);
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(RELEASES, 302);
}
