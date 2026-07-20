import { NextRequest, NextResponse } from "next/server";
import {
  selectElectronInstaller,
  type DesktopReleaseAsset,
} from "../../../../lib/desktop-release";

export const runtime = "nodejs";
export const revalidate = 300; // cache the resolved asset for 5 minutes

const REPO = "Sairo-app/app.thewcag.com";
const RELEASES = "https://github.com/Sairo-app/app.thewcag.com/releases/latest";

/** Guess the OS from the User-Agent when no ?os= is supplied. */
function osFromUserAgent(ua: string): "mac" | "windows" {
  return /windows|win64|win32/i.test(ua) ? "windows" : "mac";
}

/**
 * Stable "download the latest app" link. Resolves the newest GitHub release
 * and 302-redirects to the asset matching the requested platform
 * (`?os=mac|windows`, else inferred from the User-Agent), so marketing links
 * never hardcode a version. Falls back to the releases page.
 */
export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("os");
  const os: "mac" | "windows" =
    param === "windows" || param === "mac" ? param : osFromUserAgent(req.headers.get("user-agent") ?? "");
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "thewcag-web", Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as { assets?: DesktopReleaseAsset[] };
      const installer = selectElectronInstaller(data.assets, os);
      if (installer) return NextResponse.redirect(installer, 302);
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(RELEASES, 302);
}
