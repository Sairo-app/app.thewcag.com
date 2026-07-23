import { NextRequest, NextResponse } from "next/server";
import { claimDevice, isValidDeviceClaimCode } from "@/lib/device-claim";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_BODY_BYTES = 256;
const NO_STORE = { "Cache-Control": "no-store" };

function error(error: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error, message }, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return error("invalid_content_type", "The device claim must be sent as JSON.", 415);
  }

  let code: string;
  try {
    const value = await readBoundedJson(request, MAXIMUM_BODY_BYTES);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid payload");
    const payload = value as Record<string, unknown>;
    if (Object.keys(payload).length !== 1 || !isValidDeviceClaimCode(payload.code)) {
      throw new Error("invalid payload");
    }
    code = payload.code;
  } catch (claimError) {
    if (claimError instanceof RequestBodyTooLargeError) {
      return error("payload_too_large", "The device claim payload is too large.", 413);
    }
    return error("invalid_claim", "This device claim link is invalid.", 400);
  }

  try {
    const result = await claimDevice(code);
    if (result.status === "expired") {
      return error("claim_expired", "This sign-in link expired. Start again from the desktop app.", 410);
    }
    if (result.status === "replayed") {
      return error("claim_already_used", "This sign-in link has already been used.", 409);
    }
    if (result.status === "invalid") {
      return error("claim_not_found", "This sign-in link is no longer valid.", 404);
    }
    return NextResponse.json(
      { token: result.token, expiresAt: result.expiresAt.toISOString() },
      { headers: NO_STORE },
    );
  } catch {
    return error("temporarily_unavailable", "The device could not be connected. Try again.", 503);
  }
}
