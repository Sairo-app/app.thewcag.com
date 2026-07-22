import { createHash } from "node:crypto";

export function billingRemoteIdHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
