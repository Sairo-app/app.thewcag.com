import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { ContractValidationError, parseEvidencePacket } from "@accessibility-build/audit-contracts";
import { db } from "@/lib/db";
import { aiGenerations } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import {
  DEFAULT_FINDING_MODEL,
  generateAiFinding,
  safetyIdentifier,
} from "@/lib/ai-finding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

class AiQuotaError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("AI generation quota exceeded");
  }
}

function boundedLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

async function reserveGeneration(input: {
  userId: string;
  deviceId: string;
  requestId: string;
  model: string;
  inputBytes: number;
}): Promise<void> {
  const hourlyLimit = boundedLimit(process.env.AI_GENERATIONS_PER_HOUR, 30, 500);
  const dailyLimit = boundedLimit(process.env.AI_GENERATIONS_PER_DAY, 200, 5_000);
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1_000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1_000);

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`);
    const [[hour], [day]] = await Promise.all([
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId),
        gte(aiGenerations.createdAt, hourAgo),
      )),
      tx.select({ value: count() }).from(aiGenerations).where(and(
        eq(aiGenerations.userId, input.userId),
        gte(aiGenerations.createdAt, dayAgo),
      )),
    ]);
    if (Number(hour?.value ?? 0) >= hourlyLimit) throw new AiQuotaError(60 * 60);
    if (Number(day?.value ?? 0) >= dailyLimit) throw new AiQuotaError(24 * 60 * 60);
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

/** Generate one reviewable finding draft from evidence explicitly approved in the extension. */
export async function POST(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: "ai_unavailable",
      message: "AI authoring is not configured. Continue with the local structured draft.",
    }, { status: 503 });
  }

  let evidence;
  try {
    const body = await readBoundedJson(req, MAX_REQUEST_BYTES) as { evidence?: unknown };
    evidence = parseEvidencePacket(body.evidence);
    if (!evidence.consent?.approvedAt) throw new ContractValidationError("explicit consent is required", "evidence.consent");
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "evidence_too_large", message: "Select a smaller evidence region." }, { status: 413 });
    }
    const message = error instanceof ContractValidationError ? error.message : "Invalid evidence payload";
    return NextResponse.json({ error: "invalid_evidence", message }, { status: 400 });
  }

  const model = (process.env.OPENAI_FINDING_MODEL || DEFAULT_FINDING_MODEL).trim().slice(0, 120);
  const requestId = randomUUID();
  const inputBytes = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  try {
    await reserveGeneration({ userId: ctx.userId, deviceId: ctx.deviceId, requestId, model, inputBytes });
  } catch (error) {
    if (error instanceof AiQuotaError) {
      return NextResponse.json({
        error: "ai_quota_exceeded",
        message: "AI authoring limit reached. Continue with the local draft or try again later.",
        retryAfterSeconds: error.retryAfterSeconds,
      }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    throw error;
  }

  try {
    const draft = await generateAiFinding(evidence, {
      apiKey: process.env.OPENAI_API_KEY,
      model,
      safetyIdentifier: safetyIdentifier(ctx.userId, process.env.AI_SAFETY_SALT || process.env.AUTH_SECRET || ""),
    });
    await markGeneration(requestId, "succeeded");
    return NextResponse.json({ draft, requestId }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    await markGeneration(requestId, "failed");
    return NextResponse.json({
      error: "generation_failed",
      message: "AI authoring is temporarily unavailable. A local structured draft is still available.",
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
