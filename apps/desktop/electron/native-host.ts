import { app } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { NATIVE_PROTOCOL_VERSION, type NativeResponseV1 } from "@accessibility-build/audit-contracts";
import { AuthService } from "./services/auth";
import { AiAuthoringService } from "./services/ai-authoring";
import { JsonStore } from "./services/store";
import { handleNativeRequest } from "./services/native-protocol";
import { configuredExtensionId } from "./native-host-registration";

const MAX_MESSAGE_BYTES = 14 * 1024 * 1024;

export function nativeOriginFromArgs(args: string[]): string | null {
  return args.find((value) => /^chrome-extension:\/\/[a-p]{32}\/$/.test(value)) ?? null;
}

async function readNativeMessage(): Promise<unknown> {
  let buffer = Buffer.alloc(0);
  let expected: number | null = null;
  for await (const chunk of process.stdin) {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    if (expected === null && buffer.length >= 4) {
      expected = buffer.readUInt32LE(0);
      if (expected < 2 || expected > MAX_MESSAGE_BYTES) throw new Error("Native message is outside the allowed size");
    }
    if (expected !== null && buffer.length >= expected + 4) {
      return JSON.parse(buffer.subarray(4, expected + 4).toString("utf8"));
    }
  }
  throw new Error("Chrome closed the native messaging stream before sending a request");
}

function writeNativeMessage(value: NativeResponseV1): Promise<void> {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  if (body.length > 1024 * 1024) throw new Error("Native response exceeds Chrome's limit");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return new Promise((resolve, reject) => {
    process.stdout.write(Buffer.concat([header, body]), (error) => error ? reject(error) : resolve());
  });
}

function rawRequestId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return randomUUID();
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 64 ? requestId : randomUUID();
}

export async function runNativeHost(origin: string): Promise<void> {
  app.name = "TheWCAG";
  app.setName("TheWCAG");
  app.setPath("userData", join(app.getPath("appData"), "TheWCAG"));
  await app.whenReady();
  app.dock?.hide();

  let raw: unknown;
  try {
    raw = await readNativeMessage();
    const extensionId = await configuredExtensionId(process.resourcesPath);
    const allowedOrigin = extensionId ? `chrome-extension://${extensionId}/` : null;
    if (!allowedOrigin || origin !== allowedOrigin) {
      await writeNativeMessage({
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        requestId: rawRequestId(raw),
        ok: false,
        type: "error",
        code: "invalid-request",
        message: "This extension is not allowed to connect to TheWCAG desktop.",
        retryable: false,
      });
      app.exit(1);
      return;
    }
    const userData = app.getPath("userData");
    const store = new JsonStore(userData);
    await store.initialize();
    const auth = new AuthService(userData, store);
    const ai = new AiAuthoringService(userData, auth);
    const response = await handleNativeRequest(raw, { store, ai, appVersion: app.getVersion() });
    await writeNativeMessage(response);
    app.exit(response.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The native connector failed";
    await writeNativeMessage({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: rawRequestId(raw),
      ok: false,
      type: "error",
      code: "invalid-request",
      message: message.slice(0, 500),
      retryable: false,
    }).catch(() => undefined);
    app.exit(1);
  }
}
