import { describe, expect, it } from "vitest";
import { validAccelerator } from "./validation";

describe("global shortcut validation", () => {
  it("accepts modified keys and rejects bare keys", () => {
    expect(validAccelerator("Alt+CommandOrControl+P")).toBe(true);
    expect(validAccelerator("Control+Shift+F12")).toBe(true);
    expect(validAccelerator("P")).toBe(false);
    expect(validAccelerator("../../P")).toBe(false);
  });
});
