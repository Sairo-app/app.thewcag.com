import { NextRequest, NextResponse } from "next/server";
import {
  claimWebhook,
  billingWebhookErrorCode,
  completeWebhook,
  failWebhook,
  processDodoWebhook,
  verifyDodoWebhook,
  webhookPayloadHash,
} from "@/lib/billing/webhooks";
import { readBoundedText, RequestBodyTooLargeError } from "@/lib/bounded-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const webhookId = req.headers.get("webhook-id")?.trim();
  if (!webhookId || webhookId.length > 200) {
    return NextResponse.json({ error: "invalid_webhook_id" }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedText(req, 1_000_000);
  } catch (error) {
    return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? "webhook_too_large" : "invalid_webhook_body" }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
    });
  }
  let event;
  try {
    event = verifyDodoWebhook(rawBody, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid_webhook_signature" }, { status: 400 });
  }

  try {
    const claim = await claimWebhook({ webhookId, event, payloadHash: webhookPayloadHash(rawBody) });
    if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true });
    const outcome = await processDodoWebhook(event);
    await completeWebhook(webhookId);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    await failWebhook(webhookId, error).catch(() => undefined);
    console.error("Dodo webhook processing failed", {
      webhookId,
      code: billingWebhookErrorCode(error),
    });
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
