import { describe, expect, it } from "vitest";
import { decodePngBase64, sanitizeReportIssues } from "./reports";

describe("sanitizeReportIssues", () => {
  it("normalizes untrusted issue fields and assigns stable sequential numbers", () => {
    const issues = sanitizeReportIssues([
      { n: 99, sc: " 1.4.3 ", label: "  Contrast\u0000 issue  ", severity: "BLOCKER", note: " Fix it " },
      { n: -2, sc: "javascript:alert(1)", label: "", severity: "unknown", note: 4 },
      null,
    ]);

    expect(issues).toEqual([
      { n: 1, sc: "1.4.3", label: "Contrast  issue", severity: "blocker", note: "Fix it" },
      { n: 2, sc: undefined, label: "Accessibility issue", severity: "major", note: "" },
    ]);
  });

  it("caps issue count and text lengths", () => {
    const issues = sanitizeReportIssues(
      Array.from({ length: 5 }, () => ({ label: "x".repeat(200), note: "y".repeat(1200) })),
      2,
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].label).toHaveLength(120);
    expect(issues[0].note).toHaveLength(1000);
  });
});

describe("decodePngBase64", () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data = Buffer.alloc(0)) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([signature, chunk("IHDR", header), chunk("IEND")]);

  it("accepts a structurally complete PNG within the size limit", () => {
    expect(decodePngBase64(png.toString("base64"))).toEqual({ ok: true, buffer: png });
  });

  it("rejects non-PNG, truncated, and oversized payloads", () => {
    expect(decodePngBase64(Buffer.from("not png").toString("base64"))).toEqual({ ok: false, error: "not a PNG image" });
    expect(decodePngBase64(signature.toString("base64"))).toEqual({ ok: false, error: "not a PNG image" });
    expect(decodePngBase64(png.toString("base64"), png.length - 1)).toEqual({
      ok: false,
      error: "image too large",
    });
  });
});
