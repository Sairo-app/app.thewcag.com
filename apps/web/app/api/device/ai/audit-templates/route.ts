import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiGenerations, billingSubscriptions } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import {
  DEFAULT_AUDIT_TEMPLATE_MODEL,
  generateAuditLoggingProfile,
} from "@/lib/ai-audit-template";
import { safetyIdentifier } from "@/lib/ai-finding";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { managedAiHourlyLimit, managedAiPeriodLimit } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 650_000;

class AiQuotaError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("AI generation quota exceeded");
  }
}
class AiSubscriptionError extends Error {}

async function reserveGeneration(input: {
  userId: string;
  deviceId: string;
  requestId: string;
  model: string;
  inputBytes: number;
}): Promise<void> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1_000);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`);
    const [subscription] = await tx
      .select({ start: billingSubscriptions.currentPeriodStart, end: billingSubscriptions.currentPeriodEnd, status: billingSubscriptions.status })
      .from(billingSubscriptions)
      .where(and(
        eq(billingSubscriptions.userId, input.userId),
        eq(billingSubscriptions.status, "active"),
        gt(billingSubscriptions.currentPeriodEnd, new Date(now)),
      ))
      .orderBy(desc(billingSubscriptions.currentPeriodEnd))
      .limit(1);
    if (subscription?.status !== "active" || !subscription.end || subscription.end.getTime() <= now) {
      throw new AiSubscriptionError("subscription_inactive");
    }
    const periodStart = subscription.start ?? new Date(now - 31 * 24 * 60 * 60 * 1_000);
    const [[hour], [period]] = await Promise.all([
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId),
        gte(aiGenerations.createdAt, hourAgo),
        inArray(aiGenerations.status, ["started", "succeeded"]),
      )),
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId),
        gte(aiGenerations.createdAt, periodStart),
        inArray(aiGenerations.status, ["started", "succeeded"]),
      )),
    ]);
    if (Number(hour?.value ?? 0) >= managedAiHourlyLimit()) throw new AiQuotaError(60 * 60);
    if (Number(period?.value ?? 0) >= managedAiPeriodLimit()) {
      throw new AiQuotaError(Math.max(60, Math.ceil((subscription.end.getTime() - now) / 1_000)));
    }
    await tx.insert(aiGenerations).values({
      userId: input.userId,
      deviceId: input.deviceId,
      requestId: input.requestId,
      provider: "openai",
      model: input.model,
      status: "started",
      inputBytes: input.inputBytes,
    });
  });
}

async function markGeneration(requestId: string, status: "succeeded" | "failed"): Promise<void> {
  await db.update(aiGenerations).set({ status }).where(eq(aiGenerations.requestId, requestId)).catch(() => undefined);
}

/** Analyze an optional agency audit template for a connected desktop project. */
export async function POST(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const entitlements = await resolveEntitlements(ctx.userId);
  if (!entitlements.features.managedAi.enabled) {
    return NextResponse.json({
      error: "subscription_required",
      message: "Managed AI template analysis requires Pro. You can also select an AI provider using your own key in desktop Settings.",
      ...(entitlements.actions.billingUrl ? { billingUrl: entitlements.actions.billingUrl } : { upgradeUrl: entitlements.actions.upgradeUrl }),
    }, { status: 402, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "ai_unavailable", message: "AI template analysis is not configured." }, { status: 503 });
  }

  let template: unknown;
  try {
    const body = await readBoundedJson(req, MAX_REQUEST_BYTES) as { template?: unknown };
    template = body.template;
    if (!template || typeof template !== "object" || Array.isArray(template)) throw new Error("invalid template");
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "template_too_large", message: "Choose a smaller audit template." }, { status: 413 });
    }
    return NextResponse.json({ error: "invalid_template", message: "The audit template could not be analyzed." }, { status: 400 });
  }

  const model = (process.env.OPENAI_AUDIT_TEMPLATE_MODEL || DEFAULT_AUDIT_TEMPLATE_MODEL).trim().slice(0, 120);
  const requestId = randomUUID();
  const inputBytes = new TextEncoder().encode(JSON.stringify(template)).byteLength;
  try {
    await reserveGeneration({ userId: ctx.userId, deviceId: ctx.deviceId, requestId, model, inputBytes });
  } catch (error) {
    if (error instanceof AiSubscriptionError) {
      return NextResponse.json({ error: "subscription_inactive", message: "The Pro subscription changed before analysis started." }, { status: 402 });
    }
    if (error instanceof AiQuotaError) {
      return NextResponse.json({
        error: "ai_allowance_exhausted",
        message: "AI authoring limit reached. Try again later or select your own AI provider.",
        retryAfterSeconds: error.retryAfterSeconds,
      }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    throw error;
  }

  try {
    const profile = await generateAuditLoggingProfile(template, {
      apiKey: process.env.OPENAI_API_KEY,
      model,
      safetyIdentifier: safetyIdentifier(ctx.userId, process.env.AI_SAFETY_SALT || process.env.AUTH_SECRET || ""),
    });
    await markGeneration(requestId, "succeeded");
    return NextResponse.json({ profile, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await markGeneration(requestId, "failed");
    return NextResponse.json({
      error: "generation_failed",
      message: "AI could not derive a logging format from this template. Check that it contains a representative issue sheet and try again.",
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
