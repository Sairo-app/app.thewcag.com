import { app } from "electron";
import { randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { isAbsolute, join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { NATIVE_PROTOCOL_VERSION, type NativeResponseV1 } from "@accessibility-build/audit-contracts";
import { AuthService } from "./services/auth";
import { AiAuthoringService } from "./services/ai-authoring";
import { CaptureRepository } from "./services/captures";
import { JsonStore } from "./services/store";
import { handleNativeRequest } from "./services/native-protocol";
import { configuredExtensionId } from "./native-host-registration";

const MAX_MESSAGE_BYTES = 14 * 1024 * 1024;
const NATIVE_PIPE = /^--thewcag-native-pipe=([A-Za-z0-9._-]{1,128})$/;

function nativeDebug(message: string): void {
  if (process.env.THEWCAG_NATIVE_HOST_DEBUG === "1") {
    process.stderr.write(`[native-host] ${message}\n`);
  }
}

export function nativeOriginFromArgs(args: string[]): string | null {
  return args.find((value) => /^chrome-extension:\/\/[a-p]{32}\/$/.test(value)) ?? null;
}

export function nativePipeNameFromArgs(args: string[]): string | null {
  for (const value of args) {
    const match = value.match(NATIVE_PIPE);
    if (match) return match[1];
  }
  return null;
}

async function readNativeMessage(input: Readable): Promise<unknown> {
  let buffer = Buffer.alloc(0);
  let expected: number | null = null;
  // A native pipe is duplex. The default async iterator destroys a Readable
  // when we return early after one complete frame, which also destroys the
  // writable side before the response can be sent.
  for await (const chunk of input.iterator({ destroyOnReturn: false })) {
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

function writeNativeMessage(output: Writable, value: NativeResponseV1): Promise<void> {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  if (body.length > 1024 * 1024) throw new Error("Native response exceeds Chrome's limit");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return new Promise((resolve, reject) => {
    output.write(Buffer.concat([header, body]), (error) => error ? reject(error) : resolve());
  });
}

function connectNativePipe(pipeName: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(`\\\\.\\pipe\\${pipeName}`);
    const fail = (error: Error) => reject(error);
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.off("error", fail);
      socket.on("error", () => undefined);
      resolve(socket);
    });
  });
}

function closeNativePipe(pipe: Socket | null): Promise<void> {
  if (!pipe) return Promise.resolve();
  return new Promise((resolve) => {
    pipe.end(resolve);
  });
}

function nativeDataPath(): string {
  const override = process.env.THEWCAG_NATIVE_DATA_DIR?.trim();
  return override && isAbsolute(override)
    ? override
    : join(app.getPath("appData"), "TheWCAG");
}

function rawRequestId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return randomUUID();
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 64 ? requestId : randomUUID();
}

export async function runNativeHost(origin: string, pipeName: string | null = null): Promise<void> {
  app.name = "TheWCAG";
  app.setName("TheWCAG");
  const dataPath = nativeDataPath();
  app.setPath(
    "userData",
    pipeName
      ? join(app.getPath("temp"), "TheWCAG", "native-host", pipeName)
      : dataPath,
  );
  await app.whenReady();
  app.dock?.hide();

  let pipe: Socket | null = null;
  const input = pipeName ? (pipe = await connectNativePipe(pipeName)) : process.stdin;
  const output = pipe ?? process.stdout;
  nativeDebug(pipeName ? "pipe connected" : "stdio ready");

  let raw: unknown;
  try {
    raw = await readNativeMessage(input);
    nativeDebug("request received");
    const extensionId = await configuredExtensionId(process.resourcesPath);
    const allowedOrigin = extensionId ? `chrome-extension://${extensionId}/` : null;
    nativeDebug(`origin ${allowedOrigin === origin ? "accepted" : "rejected"}`);
    if (!allowedOrigin || origin !== allowedOrigin) {
      await writeNativeMessage(output, {
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        requestId: rawRequestId(raw),
        ok: false,
        type: "error",
        code: "invalid-request",
        message: "This extension is not allowed to connect to TheWCAG desktop.",
        retryable: false,
      });
      await closeNativePipe(pipe);
      app.exit(1);
      return;
    }
    const store = new JsonStore(dataPath);
    await store.initialize();
    nativeDebug("store ready");
    const auth = new AuthService(dataPath, store);
    const ai = new AiAuthoringService(dataPath, auth);
    const captures = new CaptureRepository(dataPath);
    await captures.initialize();
    nativeDebug("captures ready");
    const response = await handleNativeRequest(raw, {
      store,
      ai,
      captures,
      appVersion: app.getVersion(),
    });
    await writeNativeMessage(output, response);
    nativeDebug(`response written: ${response.type}`);
    await closeNativePipe(pipe);
    nativeDebug("pipe closed");
    app.exit(response.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The native connector failed";
    nativeDebug(`failure: ${message}`);
    await writeNativeMessage(output, {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: rawRequestId(raw),
      ok: false,
      type: "error",
      code: "invalid-request",
      message: message.slice(0, 500),
      retryable: false,
    }).catch(() => undefined);
    await closeNativePipe(pipe);
    app.exit(1);
  }
}
