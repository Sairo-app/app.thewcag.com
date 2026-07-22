import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getImage } from "@/lib/r2";
import { hasActiveProSubscription } from "@/lib/billing/entitlements";

export const runtime = "nodejs";

/** Stream a white-label logo only while the owner has active Pro access. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ key: users.brandLogoKey })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row?.key || !(await hasActiveProSubscription(id))) return new NextResponse("Not found", { status: 404 });

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
