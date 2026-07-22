import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  nativeTheme,
  net,
  protocol,
  session,
  type Tray,
} from "electron";
import { AuthService } from "./services/auth";
import { AiAuthoringService } from "./services/ai-authoring";
import { CaptureCoordinator } from "./services/capture-coordinator";
import { CaptureRepository } from "./services/captures";
import { ScreenCaptureService } from "./services/screen-capture";
import { SettingsService } from "./services/settings";
import { JsonStore } from "./services/store";
import { UpdateService } from "./services/updater";
import { TicketConnectorService } from "./services/ticket-connectors";
import { FunnelTelemetryService } from "./services/funnel-telemetry";
import { WindowManager } from "./windows";
import { createTray, installApplicationMenu } from "./menu";
import { registerIpc } from "./ipc";
import { migrateLegacyDesktopData } from "./migration";
import { nativeOriginFromArgs, runNativeHost } from "./native-host";
import { registerNativeMessagingHost } from "./native-host-registration";

const nativeOrigin = nativeOriginFromArgs(process.argv);
const packagedSmokeTest = process.argv.includes("--thewcag-smoke-test");

if (nativeOrigin) {
  void runNativeHost(nativeOrigin);
} else {
protocol.registerSchemesAsPrivileged([{
  scheme: "thewcag-asset",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

app.name = "TheWCAG";
app.setName("TheWCAG");
app.setAppUserModelId("com.thewcag.app");
app.commandLine.appendSwitch("force-color-profile", "srgb");
if (!app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath("userData", join(app.getPath("appData"), "TheWCAG"));
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();

let tray: Tray | null = null;
let services: {
  auth: AuthService;
  windows: WindowManager;
  settings: SettingsService;
  captureCoordinator: CaptureCoordinator;
} | null = null;
const pendingLinks: string[] = [];

function findDeepLink(args: string[]): string | null {
  return args.find((value) => value.startsWith("thewcag://")) ?? null;
}

async function handleDeepLink(url: string): Promise<void> {
  if (!services) {
    pendingLinks.push(url);
    return;
  }
  if (await services.auth.handleDeepLink(url)) {
    services.windows.showMain();
    services.windows.broadcast("account:changed", null);
  }
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  void handleDeepLink(url);
});

app.on("second-instance", (_event, argv) => {
  services?.windows.showMain();
  const link = findDeepLink(argv);
  if (link) void handleDeepLink(link);
});

async function start(): Promise<void> {
  await app.whenReady();
  nativeTheme.themeSource = "light";
  if (!packagedSmokeTest) {
    await registerNativeMessagingHost({
      platform: process.platform,
      resourcesPath: process.resourcesPath,
      executablePath: process.execPath,
      homePath: app.getPath("home"),
      userDataPath: app.getPath("userData"),
    }).catch((error) => logFatal(error));
    if (process.defaultApp && process.argv[1]) {
      app.setAsDefaultProtocolClient("thewcag", process.execPath, [process.argv[1]]);
    } else {
      app.setAsDefaultProtocolClient("thewcag");
    }
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  const userData = app.getPath("userData");
  await migrateLegacyDesktopData(app.getPath("appData"), userData);
  const store = new JsonStore(userData);
  const captures = new CaptureRepository(userData);
  await Promise.all([store.initialize(), captures.initialize()]);

  const windows = new WindowManager((error) => { void logFatal(error); });
  const screenCapture = new ScreenCaptureService();
  const captureCoordinator = new CaptureCoordinator(screenCapture, captures, windows);
  const auth = new AuthService(userData, store);
  const ai = new AiAuthoringService(userData, auth);
  const tickets = new TicketConnectorService(userData);
  const notifyError = (error: unknown) => windows.broadcast("notification", { text: error instanceof Error ? error.message : String(error), error: true });
  const settings = new SettingsService(store, {
    inspect: () => void captureCoordinator.begin("pair").catch(notifyError),
    capture: () => void captureCoordinator.begin("capture", undefined, {}, true).catch(notifyError),
    lens: () => { windows.toggleLens(); },
  }, (action, accelerator) => {
    windows.broadcast("shortcut:failed", { action, accelerator });
    windows.broadcast("notification", { text: `The ${action} shortcut ${accelerator} is already in use`, error: true });
  },
  (value) => screenCapture.setHighDpi(value.captureHighDpi));
  const telemetry = new FunnelTelemetryService(settings, store);
  const updates = new UpdateService((state) => windows.broadcast("update:state", state));

  services = { auth, windows, settings, captureCoordinator };
  registerIpc({ ai, auth, captureCoordinator, captures, capture: screenCapture, settings, store, telemetry, tickets, updates, windows });

  protocol.handle("thewcag-asset", async (request) => {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    const url = new URL(request.url);
    if (url.hostname !== "capture") return new Response("Not found", { status: 404 });
    const id = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const kind = url.searchParams.get("kind") === "thumbnail" ? "thumbnail" : "raw";
    try {
      const response = await net.fetch(pathToFileURL(captures.resolveAsset(id, kind)).toString());
      if (!response.ok) return new Response("Not found", { status: 404 });
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "private, no-store",
          "Content-Type": response.headers.get("content-type") || "image/png",
          "Cross-Origin-Resource-Policy": "cross-origin",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  await settings.initialize();
  const actions = { windows, captures: captureCoordinator };
  installApplicationMenu(actions);
  tray = createTray(actions);
  windows.createMain();

  const initialLink = findDeepLink(process.argv);
  if (initialLink) pendingLinks.push(initialLink);
  for (const link of pendingLinks.splice(0)) await handleDeepLink(link);

  if (!packagedSmokeTest) {
    setTimeout(() => { void updates.check(false); }, 8_000);
  }
}

app.on("activate", () => services?.windows.showMain());
app.on("before-quit", () => services?.settings.dispose());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function logFatal(error: unknown): Promise<void> {
  try {
    const directory = join(app.getPath("userData"), "logs");
    await mkdir(directory, { recursive: true });
    const message = error instanceof Error ? `${error.stack || error.message}\n` : `${String(error)}\n`;
    await appendFile(join(directory, "main.log"), `${new Date().toISOString()} ${message}`, { mode: 0o600 });
  } catch {
    // There is no safe recovery path if logging itself fails.
  }
}

process.on("uncaughtException", (error) => { void logFatal(error); });
process.on("unhandledRejection", (error) => { void logFatal(error); });

void start().catch(async (error) => {
  await logFatal(error);
  app.quit();
});

void tray;
}
