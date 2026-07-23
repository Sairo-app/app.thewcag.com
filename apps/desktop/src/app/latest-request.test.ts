import { describe, expect, it } from "vitest";
import { LatestRequest } from "./latest-request";

describe("latest request guard", () => {
  it("prevents an older capture load from overwriting a newer result", async () => {
    let resolveFirst!: (value: string[]) => void;
    let resolveSecond!: (value: string[]) => void;
    const first = new Promise<string[]>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<string[]>((resolve) => { resolveSecond = resolve; });
    const applied: string[][] = [];
    const guard = new LatestRequest<string[]>();

    const older = guard.run(() => first, (value) => applied.push(value));
    const newer = guard.run(() => second, (value) => applied.push(value));
    resolveSecond(["newer"]);
    await expect(newer).resolves.toEqual(["newer"]);
    resolveFirst(["older"]);
    await expect(older).resolves.toEqual(["newer"]);
    expect(applied).toEqual([["newer"]]);
  });

  it("does not apply or return a request after invalidation", async () => {
    let resolveLoad!: (value: string[]) => void;
    const load = new Promise<string[]>((resolve) => { resolveLoad = resolve; });
    const applied: string[][] = [];
    const guard = new LatestRequest<string[]>();

    const pending = guard.run(() => load, (value) => applied.push(value));
    guard.invalidate();
    resolveLoad(["late"]);

    await expect(pending).resolves.toBeNull();
    expect(applied).toEqual([]);
  });
});
