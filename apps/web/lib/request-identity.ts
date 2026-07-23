import { createHmac } from "node:crypto";

function requestHashSecret(): string {
  const secret = process.env.REQUEST_HASH_SECRET
    ?? process.env.AUTH_SECRET
    ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("REQUEST_HASH_SECRET or AUTH_SECRET is required for request abuse protection.");
  }
  return "thewcag-local-request-hash-secret";
}

export function clientAddress(headers: Headers): string {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  return forwarded || "unknown";
}

/** A scoped, non-reversible request identity. The raw address is never stored. */
export function hashedClientIdentity(headers: Headers, scope: string): string {
  return createHmac("sha256", requestHashSecret())
    .update(`${scope}\0${clientAddress(headers)}`)
    .digest("hex");
}
