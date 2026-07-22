import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { dodoClient, requireDodoHostedUrl } from "@/lib/billing/dodo";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { billingConfigured, planForChoice } from "@/lib/billing/plans";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import { db } from "@/lib/db";
import { billingCustomers, billingSubscriptions } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";
import { BillingSessionPendingError, BillingSessionRateLimitError, completeBillingSession, reserveBillingSession } from "@/lib/billing/session-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "content_type_required" }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(req.url).origin) {
        return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    }
  }
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable", message: "Subscriptions are not available yet." }, { status: 503 });
  }

  let body: { plan?: unknown };
  try {
    body = await readBoundedJson(req, 2_048) as { plan?: unknown };
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestBodyTooLargeError ? "request_too_large" : "invalid_body" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    );
  }
  const plan = planForChoice(body.plan);
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const entitlements = await resolveEntitlements(userId);
  const [nonterminalSubscription] = await db
    .select({ id: billingSubscriptions.id })
    .from(billingSubscriptions)
    .where(and(
      eq(billingSubscriptions.userId, userId),
      inArray(billingSubscriptions.status, ["pending", "active", "on_hold"]),
    ))
    .limit(1);
  if (entitlements.plan === "pro" || nonterminalSubscription) {
    return NextResponse.json({
      error: "subscription_exists",
      message: "A subscription is already active or processing for this account.",
      url: entitlements.actions.billingUrl ?? `${SITE_URL}/account`,
    }, { status: 409 });
  }

  const [customer] = await db
    .select({ dodoCustomerId: billingCustomers.dodoCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);

  let attemptId: string;
  try {
    attemptId = await reserveBillingSession({ userId, kind: "checkout", planChoice: plan.choice });
  } catch (error) {
    if (error instanceof BillingSessionPendingError) {
      return NextResponse.json({
        error: error.message,
        message: "A recent checkout is still awaiting confirmation. Check your account in a few minutes before trying again.",
        url: `${SITE_URL}/account`,
      }, { status: 409, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    if (error instanceof BillingSessionRateLimitError) {
      return NextResponse.json({ error: error.message, message: "Too many checkout attempts. Try again in an hour." }, {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      });
    }
    throw error;
  }

  try {
    const checkout = await dodoClient().checkoutSessions.create({
      product_cart: [{ product_id: plan.productId, quantity: 1 }],
      customer: customer ? { customer_id: customer.dodoCustomerId } : { email },
      return_url: `${SITE_URL}/billing/return`,
      cancel_url: `${SITE_URL}/pricing?checkout=cancelled`,
      metadata: {
        thewcag_user_id: userId,
        thewcag_plan: plan.planKey,
        thewcag_plan_choice: plan.choice,
      },
      feature_flags: {
        allow_customer_editing_email: false,
        always_create_new_customer: false,
        redirect_immediately: true,
      },
      customization: { theme: "system" },
    });
    const url = requireDodoHostedUrl(checkout.checkout_url, "checkout");
    await completeBillingSession(attemptId, "succeeded", checkout.session_id);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await completeBillingSession(attemptId, "failed").catch(() => undefined);
    console.error("Dodo checkout session creation failed", {
      userId,
      code: error instanceof Error ? error.name : "unknown_checkout_error",
    });
    return NextResponse.json({
      error: "checkout_unavailable",
      message: "Checkout could not be started. Please try again.",
    }, { status: 502 });
  }
}
