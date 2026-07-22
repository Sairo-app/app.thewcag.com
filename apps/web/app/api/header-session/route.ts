import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return NextResponse.json(
    {
      signedIn: Boolean(session?.user),
      email,
      admin: isAdminEmail(email),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
