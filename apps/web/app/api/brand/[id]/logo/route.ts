import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getImage } from "@/lib/r2";
import { isBrandAssetToken } from "@/lib/brand";

export const runtime = "nodejs";

/**
 * Stream a public brand asset by opaque token. UUID lookup remains temporarily
 * available for already-rendered legacy report URLs. Entitlement is enforced
 * by the report page, so this asset response does not expose subscription state.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ key: users.brandLogoKey })
    .from(users)
    .where(eq(isBrandAssetToken(id) ? users.brandAssetToken : users.id, id))
    .limit(1);
  if (!row?.key) return new NextResponse("Not found", { status: 404 });

  const obj = await getImage(row.key);
  if (!obj) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
      ...(obj.contentType === "image/svg+xml"
        ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" }
        : {}),
    },
  });
}
