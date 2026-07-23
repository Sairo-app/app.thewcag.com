export type GenericStoreChannel = "store:get" | "store:set" | "store:remove";

const RESERVED_STORE_KEYS = new Set([
  "finding-identities",
  "auth-pending",
  "auth-entitlements-cache",
  "settings",
  "funnel-telemetry-v1",
]);

export function assertRendererStoreAccess(
  channel: GenericStoreChannel,
  key: string,
): void {
  if (RESERVED_STORE_KEYS.has(key)) {
    throw new Error(`${channel} cannot access main-process storage key ${key}`);
  }
}
