import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { dodoClient, requireDodoHostedUrl } from "@/lib/billing/dodo";
import { db } from "@/lib/db";
import { billingCustomers } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";
import { BillingSessionRateLimitError, completeBillingSession, reserveBillingSession } from "@/lib/billing/session-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json(
      { error: "cross_site_request_rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.redirect(`${SITE_URL}/signin?callbackUrl=/account`);
  const [customer] = await db
    .select({ dodoCustomerId: billingCustomers.dodoCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  if (!customer) return NextResponse.redirect(`${SITE_URL}/account?billing=not-found`);

  let attemptId: string;
  try {
    attemptId = await reserveBillingSession({ userId, kind: "portal" });
  } catch (error) {
    if (error instanceof BillingSessionRateLimitError) {
      return NextResponse.redirect(`${SITE_URL}/account?billing=rate-limited`);
    }
    return NextResponse.redirect(`${SITE_URL}/account?billing=portal-error`);
  }

  try {
    const portal = await dodoClient().customers.customerPortal.create(customer.dodoCustomerId, {
      return_url: `${SITE_URL}/account`,
      send_email: false,
    });
    const url = requireDodoHostedUrl(portal.link, "portal");
    await completeBillingSession(attemptId, "succeeded");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    await completeBillingSession(attemptId, "failed").catch(() => undefined);
    console.error("Dodo customer portal creation failed", {
      userId,
      code: error instanceof Error ? error.name : "unknown_portal_error",
    });
    return NextResponse.redirect(`${SITE_URL}/account?billing=portal-error`);
  }
}
