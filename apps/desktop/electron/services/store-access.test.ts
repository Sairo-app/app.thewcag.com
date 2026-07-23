import { describe, expect, it } from "vitest";
import { assertRendererStoreAccess, type GenericStoreChannel } from "./store-access";

describe("renderer generic store access", () => {
  const channels: GenericStoreChannel[] = ["store:get", "store:set", "store:remove"];
  const reserved = [
    "finding-identities",
    "auth-pending",
    "auth-entitlements-cache",
    "settings",
    "funnel-telemetry-v1",
  ];

  it.each(channels)("rejects reserved keys through %s", (channel) => {
    for (const key of reserved) {
      expect(() => assertRendererStoreAccess(channel, key)).toThrow(/main-process storage key/);
    }
  });

  it("rejects renderer store:set on an internal key but allows audit data", () => {
    expect(() => assertRendererStoreAccess("store:set", "auth-pending")).toThrow();
    expect(() => assertRendererStoreAccess("store:set", "checklist-aud-example1")).not.toThrow();
  });
});
