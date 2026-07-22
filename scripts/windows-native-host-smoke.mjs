import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "win32") {
  throw new Error("The packaged native-host smoke test must run on Windows");
}

const appDirectory = resolve(process.argv[2] || "apps/desktop/release/win-unpacked");
const nativeDirectory = join(appDirectory, "resources", "native-messaging");
const hostPath = join(nativeDirectory, "TheWCAG.NativeHost.exe");
const extensionId = (await readFile(join(nativeDirectory, "extension-id.txt"), "utf8")).trim();
assert.match(extensionId, /^[a-p]{32}$/, "packaged extension ID is invalid");

const requestId = randomUUID();
const request = Buffer.from(JSON.stringify({
  protocolVersion: 1,
  requestId,
  type: "ping",
}), "utf8");
const frame = Buffer.allocUnsafe(4 + request.length);
frame.writeUInt32LE(request.length, 0);
request.copy(frame, 4);

const dataDirectory = await mkdtemp(join(tmpdir(), "thewcag-native-host-smoke-"));
try {
  const child = spawn(hostPath, [`chrome-extension://${extensionId}/`], {
    cwd: nativeDirectory,
    env: { ...process.env, THEWCAG_NATIVE_DATA_DIR: dataDirectory },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  child.stdin.end(frame);

  const exitCode = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("packaged native host timed out"));
    }, 75_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });

  const output = Buffer.concat(stdout);
  const stderrText = Buffer.concat(stderr).toString("utf8");
  assert.ok(output.length >= 4, `native host returned no frame; stderr=${stderrText}`);
  const responseLength = output.readUInt32LE(0);
  assert.equal(output.length, responseLength + 4, "native host wrote bytes outside the Chrome protocol frame");
  const response = JSON.parse(output.subarray(4).toString("utf8"));
  assert.equal(response.requestId, requestId, "native host changed the request identity");
  assert.equal(response.ok, true, `${response.message || "native host returned an error"}; stderr=${stderrText}`);
  assert.equal(response.type, "pong");
  assert.match(response.appVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(exitCode, 0, "native host exited unsuccessfully");
  console.log(`packaged Windows native host handshake passed for TheWCAG ${response.appVersion}`);
} finally {
  await rm(dataDirectory, { recursive: true, force: true });
}
