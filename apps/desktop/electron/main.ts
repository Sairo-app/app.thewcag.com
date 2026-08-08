import { appendFile, mkdir } from "node:fs/promises";
import { arch, release } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  nativeTheme,
  net,
  Notification,
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
import { CrashReportService } from "./services/crash-reports";
import type { CrashReportOrigin } from "../src/shared/desktop";
import { AuditTemplateService } from "./services/audit-template";
import { WindowManager } from "./windows";
import { createTray, installApplicationMenu, type NativeActions } from "./menu";
import { registerIpc } from "./ipc";
import { migrateLegacyDesktopData } from "./migration";
import { nativeOriginFromArgs, nativePipeNameFromArgs, runNativeHost } from "./native-host";
import { registerNativeMessagingHost } from "./native-host-registration";

const nativeOrigin = nativeOriginFromArgs(process.argv);
const nativePipeName = nativePipeNameFromArgs(process.argv);
const packagedSmokeTest = process.argv.includes("--thewcag-smoke-test");

if (nativeOrigin) {
  void runNativeHost(nativeOrigin, nativePipeName);
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
let stopFindingsWatch: (() => void) | null = null;
let stopStoreQuarantine: (() => void) | null = null;
// Set once the store and settings exist. Crashes before that point are still
// written to the local log; there is simply no consent to read yet.
let crashReports: CrashReportService | null = null;
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
  try {
    await services.auth.handleDeepLink(url);
    services.windows.showMain();
    services.windows.broadcast("account:changed", null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The device could not be connected. Try again.";
    services.windows.showMain();
    services.windows.broadcast("notification", { text: message, error: true });
    if (Notification.isSupported()) {
      new Notification({ title: "Sign-in not completed", body: message }).show();
    }
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
  const pendingStoreNotifications: string[] = [];
  let storeNotificationsReady = false;
  stopStoreQuarantine = store.onQuarantine((event) => {
    if (storeNotificationsReady) {
      windows.broadcast("notification", { text: event.message, error: true });
    } else {
      pendingStoreNotifications.push(event.message);
    }
  });
  await store.sweepOrphanedEvidence().catch((error) => logFatal(error));
  stopFindingsWatch = store.watchFindings((key) => {
    windows.broadcast("findings:changed", { key });
  });
  const screenCapture = new ScreenCaptureService();
  const captureCoordinator = new CaptureCoordinator(screenCapture, captures, windows);
  const auth = new AuthService(userData, store);
  const ai = new AiAuthoringService(userData, auth);
  const auditTemplates = new AuditTemplateService(userData);
  const tickets = new TicketConnectorService(userData);
  const notifyError = (error: unknown) => windows.broadcast("notification", { text: error instanceof Error ? error.message : String(error), error: true });
  let menuActions: NativeActions | null = null;
  const settings = new SettingsService(store, {
    inspect: () => void captureCoordinator.begin("pair").catch(notifyError),
    capture: () => void captureCoordinator.begin("capture", undefined, {}, true).catch(notifyError),
    lens: () => { windows.toggleLens(); },
  }, (action, accelerator) => {
    windows.broadcast("shortcut:failed", { action, accelerator });
    windows.broadcast("notification", { text: `The ${action} shortcut ${accelerator} is already in use`, error: true });
  },
  (value) => {
    screenCapture.setHighDpi(value.captureHighDpi);
    if (menuActions) installApplicationMenu(menuActions, value.shortcuts);
  });
  const telemetry = new FunnelTelemetryService(settings, store);
  crashReports = new CrashReportService(settings, store, {
    appVersion: app.getVersion(),
    platform: process.platform,
    osRelease: release(),
    arch: arch(),
  });
  app.on("render-process-gone", (_event, _contents, details) => {
    void reportCrash(
      "renderer-process-gone",
      new Error(`Renderer process gone: ${details.reason} (exit code ${details.exitCode})`),
    );
  });
  app.on("child-process-gone", (_event, details) => {
    void reportCrash(
      "child-process-gone",
      new Error(`Child process gone: ${details.type} ${details.reason}`),
    );
  });
  const updates = new UpdateService((state) => windows.broadcast("update:state", state));

  services = { auth, windows, settings, captureCoordinator };
  registerIpc({ ai, auditTemplates, auth, captureCoordinator, captures, capture: screenCapture, settings, store, telemetry, tickets, updates, windows });

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

  const initialSettings = await settings.initialize();
  const actions = { windows, captures: captureCoordinator };
  menuActions = actions;
  installApplicationMenu(actions, initialSettings.shortcuts);
  tray = createTray(actions);
  const mainWindow = windows.createMain();
  const flushStoreNotifications = () => {
    storeNotificationsReady = true;
    for (const message of pendingStoreNotifications.splice(0)) {
      windows.broadcast("notification", { text: message, error: true });
    }
  };
  if (mainWindow.isVisible()) {
    flushStoreNotifications();
  } else {
    mainWindow.once("ready-to-show", flushStoreNotifications);
  }

  const initialLink = findDeepLink(process.argv);
  if (initialLink) pendingLinks.push(initialLink);
  for (const link of pendingLinks.splice(0)) await handleDeepLink(link);

  if (!packagedSmokeTest) {
    setTimeout(() => { void updates.check(false); }, 8_000);
  }
}

app.on("activate", () => services?.windows.showMain());
app.on("before-quit", () => {
  stopFindingsWatch?.();
  stopFindingsWatch = null;
  stopStoreQuarantine?.();
  stopStoreQuarantine = null;
  services?.settings.dispose();
});
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

/**
 * Sending is best effort and must never mask the original failure: the local
 * log is written first and a reporting error is swallowed.
 */
async function reportCrash(origin: CrashReportOrigin, error: unknown): Promise<void> {
  await logFatal(error);
  try {
    await crashReports?.report(origin, error);
  } catch {
    // Diagnostics must not become a second failure.
  }
}

process.on("uncaughtException", (error) => { void reportCrash("main-uncaught-exception", error); });
process.on("unhandledRejection", (error) => { void reportCrash("main-unhandled-rejection", error); });

void start().catch(async (error) => {
  await logFatal(error);
  app.quit();
});

void tray;
}
