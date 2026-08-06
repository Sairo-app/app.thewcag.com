import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiGenerations, billingSubscriptions } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import { DEFAULT_AUDIT_TEMPLATE_MODEL, generateAuditTemplatePrefill } from "@/lib/ai-audit-template";
import { safetyIdentifier } from "@/lib/ai-finding";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { managedAiHourlyLimit, managedAiPeriodLimit } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 250_000;

class AiQuotaError extends Error {
  constructor(readonly retryAfterSeconds: number) { super("AI generation quota exceeded"); }
}
class AiSubscriptionError extends Error {}

async function reserveGeneration(input: {
  userId: string; deviceId: string; requestId: string; model: string; inputBytes: number;
}): Promise<void> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1_000);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`);
    const [subscription] = await tx.select({
      start: billingSubscriptions.currentPeriodStart,
      end: billingSubscriptions.currentPeriodEnd,
      status: billingSubscriptions.status,
    }).from(billingSubscriptions).where(and(
      eq(billingSubscriptions.userId, input.userId),
      eq(billingSubscriptions.status, "active"),
      gt(billingSubscriptions.currentPeriodEnd, new Date(now)),
    )).orderBy(desc(billingSubscriptions.currentPeriodEnd)).limit(1);
    if (subscription?.status !== "active" || !subscription.end || subscription.end.getTime() <= now) {
      throw new AiSubscriptionError("subscription_inactive");
    }
    const periodStart = subscription.start ?? new Date(now - 31 * 24 * 60 * 60 * 1_000);
    const [[hour], [period]] = await Promise.all([
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId), gte(aiGenerations.createdAt, hourAgo),
        inArray(aiGenerations.status, ["started", "succeeded"]),
      )),
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId), gte(aiGenerations.createdAt, periodStart),
        inArray(aiGenerations.status, ["started", "succeeded"]),
      )),
    ]);
    if (Number(hour?.value ?? 0) >= managedAiHourlyLimit()) throw new AiQuotaError(60 * 60);
    if (Number(period?.value ?? 0) >= managedAiPeriodLimit()) {
      throw new AiQuotaError(Math.max(60, Math.ceil((subscription.end.getTime() - now) / 1_000)));
    }
    await tx.insert(aiGenerations).values({
      userId: input.userId, deviceId: input.deviceId, requestId: input.requestId,
      provider: "openai", model: input.model, status: "started", inputBytes: input.inputBytes,
    });
  });
}

async function markGeneration(requestId: string, status: "succeeded" | "failed") {
  await db.update(aiGenerations).set({ status }).where(eq(aiGenerations.requestId, requestId)).catch(() => undefined);
}

export async function POST(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entitlements = await resolveEntitlements(ctx.userId);
  if (!entitlements.features.managedAi.enabled) {
    return NextResponse.json({
      error: "subscription_required",
      message: "Managed AI template prefill requires Pro or your own configured AI key.",
      ...(entitlements.actions.billingUrl ? { billingUrl: entitlements.actions.billingUrl } : { upgradeUrl: entitlements.actions.upgradeUrl }),
    }, { status: 402, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });

  let input: unknown;
  try {
    input = await readBoundedJson(req, MAX_REQUEST_BYTES);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
  } catch (error) {
    return NextResponse.json({
      error: error instanceof RequestBodyTooLargeError ? "request_too_large" : "invalid_request",
      message: "The agency-field prefill request is invalid.",
    }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }

  const model = (process.env.OPENAI_AUDIT_TEMPLATE_MODEL || DEFAULT_AUDIT_TEMPLATE_MODEL).trim().slice(0, 120);
  const requestId = randomUUID();
  const inputBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  try {
    await reserveGeneration({ userId: ctx.userId, deviceId: ctx.deviceId, requestId, model, inputBytes });
  } catch (error) {
    if (error instanceof AiSubscriptionError) return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
    if (error instanceof AiQuotaError) {
      return NextResponse.json({ error: "ai_allowance_exhausted", retryAfterSeconds: error.retryAfterSeconds }, {
        status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) },
      });
    }
    throw error;
  }
  try {
    const result = await generateAuditTemplatePrefill(input, {
      apiKey: process.env.OPENAI_API_KEY,
      model,
      safetyIdentifier: safetyIdentifier(ctx.userId, process.env.AI_SAFETY_SALT || process.env.AUTH_SECRET || ""),
    });
    await markGeneration(requestId, "succeeded");
    return NextResponse.json({ result, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await markGeneration(requestId, "failed");
    return NextResponse.json({ error: "generation_failed", message: "AI could not fill the agency fields." }, { status: 502 });
  }
}
