import { describe, expect, it } from "vitest";
import {
  EVIDENCE_SCHEMA_VERSION,
  type AiFindingDraftV1,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import {
  clampEvidencePatch,
  consumeOwnStorageEcho,
  draftPersistenceAction,
  rememberStorageWrite,
  restoreEvidencePacket,
  restoreSavedFindingMarker,
  type LastWrittenStorage,
} from "./storage-state";
import { storageWriteFailureMessage } from "../shared/storage";

function evidence(): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "fc926f9f-e1bf-4590-ad71-a22ebca60dcc",
    findingId: "WCG-F-20260722-00000-00000-00000-00000-000000",
    capturedAt: 1_800_000_000_000,
    captureMode: "element",
    observation: "The checkout button is announced only as button.",
    taskContext: "Complete checkout",
    page: {
      title: "Checkout",
      url: "https://example.com/checkout",
      origin: "https://example.com",
      locale: "en",
      browser: "Chrome",
      viewport: {
        width: 1280,
        height: 720,
        devicePixelRatio: 2,
        visualScale: 1,
        offsetLeft: 0,
        offsetTop: 0,
      },
    },
    target: {
      kind: "element",
      tagName: "button",
      role: "button",
      accessibleName: "Pay now",
      accessibleDescription: "",
      selector: "button#pay",
      structuralPath: "html > body > main > button",
      bounds: { x: 100, y: 200, width: 120, height: 40 },
      marker: { x: 100, y: 200, width: 120, height: 40 },
      states: ["focusable"],
      labels: [],
      nearbyHeading: "Checkout",
      landmark: "main",
      attributes: { id: "pay" },
      styles: { display: "inline-flex" },
      domExcerpt: "<button id=\"pay\">Pay now</button>",
    },
    image: {
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,AAAA",
      width: 10,
      height: 10,
      sourceWidth: 10,
      sourceHeight: 10,
    },
    checks: [],
    omissions: [],
  };
}

describe("side-panel storage state", () => {
  it("truncates and recovers a 2100-character observation without losing its capture", () => {
    const stored = {
      ...evidence(),
      observation: "o".repeat(2_100),
      taskContext: "Task context survives",
    };

    const firstReopen = restoreEvidencePacket(stored);
    expect(firstReopen.recoveredFields).toEqual(["observation"]);
    expect(firstReopen.evidence.observation).toHaveLength(2_000);
    expect(firstReopen.evidence.taskContext).toBe("Task context survives");
    expect(firstReopen.evidence.image).toEqual(stored.image);

    const secondReopen = restoreEvidencePacket(firstReopen.evidence);
    expect(secondReopen.recoveredFields).toEqual([]);
    expect(secondReopen.evidence).toEqual(firstReopen.evidence);
  });

  it("clamps editable evidence patches to their contract limits", () => {
    const patch = clampEvidencePatch({
      observation: "o".repeat(2_100),
      taskContext: "t".repeat(1_100),
    });

    expect(patch.observation).toHaveLength(2_000);
    expect(patch.taskContext).toHaveLength(1_000);
  });

  it("does not classify non-editable packet corruption as a recoverable long note", () => {
    expect(() => restoreEvidencePacket({
      ...evidence(),
      page: null,
    })).toThrow(/evidence\.page/);
  });

  it("consumes a structurally cloned self-write echo but not newer local input", () => {
    const lastWritten: LastWrittenStorage = {};
    const written = { observation: "saved value", taskContext: "Checkout" };
    rememberStorageWrite(lastWritten, { evidence: written });

    expect(consumeOwnStorageEcho(
      lastWritten,
      "evidence",
      JSON.parse(JSON.stringify(written)),
    )).toBe(true);

    rememberStorageWrite(lastWritten, { evidence: written });
    expect(consumeOwnStorageEcho(lastWritten, "evidence", {
      ...written,
      observation: "newer characters still being typed",
    })).toBe(false);
  });

  it("gates draft removal until restore completes, then removes a user-cleared draft", () => {
    expect(draftPersistenceAction(false, null)).toBe("none");
    expect(draftPersistenceAction(true, null)).toBe("remove");
    expect(draftPersistenceAction(true, {} as AiFindingDraftV1)).toBe("set");
  });

  it("restores a saved marker only for the current immutable finding ID", () => {
    const current = evidence();
    const marker = {
      key: current.id,
      findingId: current.findingId,
      auditId: "aud-checkout1",
    };

    expect(restoreSavedFindingMarker(marker, current.findingId)).toEqual(marker);
    expect(restoreSavedFindingMarker(marker, "WCG-F-20260722-00000-00000-00000-00000-000001")).toBeNull();
  });

  it("turns quota failures into a visible unsaved-changes warning", () => {
    expect(storageWriteFailureMessage(new Error("QUOTA_BYTES quota exceeded"))).toMatch(
      /^Changes are not being saved because extension storage is full\./,
    );
    expect(storageWriteFailureMessage(new Error("Storage backend unavailable"))).toMatch(
      /^Changes are not being saved because Chrome rejected/,
    );
  });
});
