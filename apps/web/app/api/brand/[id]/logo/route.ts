import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getImage, publicImageUrl } from "@/lib/r2";

export const runtime = "nodejs";

/** Serve a user's white-label logo. Redirects to the R2 CDN in production,
 *  streams from the bucket in dev. Public by design — it's on shared reports. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ key: users.brandLogoKey })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row?.key) return new NextResponse("Not found", { status: 404 });

  const cdn = publicImageUrl(row.key);
  if (cdn) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: cdn, "Cache-Control": "public, max-age=3600" },
    });
  }

  const obj = await getImage(row.key);
  if (!obj) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(obj.body), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "public, max-age=3600" },
  });
}
