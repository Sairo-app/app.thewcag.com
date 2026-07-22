import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const executable = resolve(process.argv[2] || join(root, "apps", "desktop", "release", "win-unpacked", "TheWCAG.exe"));

if (process.platform !== "win32") {
  console.log("Packaged desktop runtime smoke test is Windows-only; skipped.");
  process.exit(0);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert(address && typeof address === "object", "Could not reserve a debugging port");
  const port = address.port;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function pageTarget(port, child) {
  const deadline = Date.now() + 30_000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`The packaged desktop process exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`The packaged renderer did not expose a page within 30 seconds${lastError ? `: ${lastError}` : ""}`);
}

async function inspectRenderer(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to the packaged renderer")), { once: true });
  });
  try {
    const response = await new Promise((resolveResponse, reject) => {
      const timer = setTimeout(() => reject(new Error("The packaged renderer did not answer the smoke probe")), 20_000);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.id !== 1) return;
        clearTimeout(timer);
        resolveResponse(message);
      });
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          awaitPromise: true,
          returnByValue: true,
          expression: `new Promise((resolve) => {
            const inspect = () => {
              const root = document.querySelector('#root');
              const bodyText = document.body?.innerText || '';
              const applicationReady = /Plan the evaluation|New audit|No active audit|Inspect|Evidence/i.test(bodyText);
              if (document.readyState === 'complete' && root?.childElementCount && applicationReady) {
                const rect = root.getBoundingClientRect();
                resolve({ readyState: document.readyState, rootChildren: root.childElementCount, bodyText: bodyText.slice(0, 2000), width: rect.width, height: rect.height });
              } else setTimeout(inspect, 100);
            };
            inspect();
            setTimeout(() => resolve({ readyState: document.readyState, rootChildren: document.querySelector('#root')?.childElementCount || 0, bodyText: (document.body?.innerText || '').slice(0, 2000), width: 0, height: 0 }), 15000);
          })`,
        },
      }));
    });
    if (response.error) throw new Error(response.error.message || "Renderer inspection failed");
    return response.result?.result?.value;
  } finally {
    socket.close();
  }
}

async function removeTemporaryProfile(profile) {
  let lastError = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(error?.code)) throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw lastError;
}

const profile = await mkdtemp(join(tmpdir(), "thewcag-runtime-smoke-"));
const port = await availablePort();
const child = spawn(executable, [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  "--thewcag-smoke-test",
  "--no-first-run",
], {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += String(chunk); });

try {
  const target = await pageTarget(port, child);
  const rendered = await inspectRenderer(target.webSocketDebuggerUrl);
  assert.equal(rendered?.readyState, "complete", "The packaged document did not finish loading");
  assert(rendered.rootChildren > 0, "The packaged React root is empty");
  assert(rendered.width > 0 && rendered.height > 0, "The packaged renderer has no visible layout");
  assert.match(rendered.bodyText, /Plan the evaluation|New audit|No active audit|Inspect|Evidence/i, `The packaged renderer did not show application content: ${rendered.bodyText.slice(0, 300)}`);
  assert.doesNotMatch(rendered.bodyText, /Something went wrong|could not start/i, "The packaged renderer showed a startup failure");
  console.log(`Packaged Windows renderer loaded ${target.url} with ${rendered.rootChildren} root element(s) at ${Math.round(rendered.width)}×${Math.round(rendered.height)}.`);
} catch (error) {
  let mainLog = "";
  try { mainLog = await readFile(join(profile, "logs", "main.log"), "utf8"); } catch { /* log is optional */ }
  throw new Error(`${error instanceof Error ? error.message : error}\n${stderr.slice(-4000)}\n${mainLog.slice(-4000)}`.trim());
} finally {
  if (child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  const temporaryRoot = `${resolve(tmpdir())}${sep}`.toLowerCase();
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.toLowerCase().startsWith(temporaryRoot) && basename(resolvedProfile).startsWith("thewcag-runtime-smoke-")) {
    await removeTemporaryProfile(resolvedProfile);
  }
}
