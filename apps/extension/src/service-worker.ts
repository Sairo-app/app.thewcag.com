import { ACTION_PIXEL_HEX, DANGER_PIXEL_HEX, createEvidencePacket } from "./evidence";
import { isProtectedBrowserPage, pageAccessMessage } from "./page-access";
import { runIssuePicker } from "./picker";
import {
  isExtensionRequest,
  isPanelPortMessage,
  PANEL_PORT_NAME,
  PICKER_ABORT_MESSAGE,
  type ExtensionResponse,
} from "./shared/messages";
import {
  CAPTURE_TOO_LARGE_MESSAGE,
  CAPTURE_TAB_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  EVIDENCE_STORAGE_KEY,
  isStorageQuotaError,
  QUEUED_FINDING_STORAGE_KEY,
  SAVED_FINDING_STORAGE_KEY,
} from "./shared/storage";
import { keepActionPopupOnClick } from "./browser-panel";

void keepActionPopupOnClick();

const capturePromises = new Map<number, Promise<ExtensionResponse>>();
const panelPortsByWindow = new Map<number, Set<chrome.runtime.Port>>();
const windowByPanelPort = new Map<chrome.runtime.Port, number>();

function detachPanelPort(port: chrome.runtime.Port): void {
  const windowId = windowByPanelPort.get(port);
  if (windowId === undefined) return;
  windowByPanelPort.delete(port);
  const ports = panelPortsByWindow.get(windowId);
  ports?.delete(port);
  if (!ports?.size) panelPortsByWindow.delete(windowId);
}

function attachPanelPort(port: chrome.runtime.Port, windowId: number): void {
  detachPanelPort(port);
  const ports = panelPortsByWindow.get(windowId) ?? new Set<chrome.runtime.Port>();
  ports.add(port);
  panelPortsByWindow.set(windowId, ports);
  windowByPanelPort.set(port, windowId);
}

function hasConnectedPanel(windowId: number): boolean {
  return Boolean(panelPortsByWindow.get(windowId)?.size);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PANEL_PORT_NAME) return;
  port.onMessage.addListener((message: unknown) => {
    if (!isPanelPortMessage(message)) return;
    if (message.type === "panel-connected") attachPanelPort(port, message.windowId);
    else void markAction(message.tabId, "", ACTION_PIXEL_HEX);
  });
  port.onDisconnect.addListener(() => detachPanelPort(port));
});

chrome.runtime.onInstalled.addListener(() => {
  void keepActionPopupOnClick();
});

chrome.runtime.onStartup.addListener(() => {
  void keepActionPopupOnClick();
});

function showPageNotice(tone: "success" | "danger", message: string): void {
  document.querySelector("[data-thewcag-notice]")?.remove();
  const host = document.createElement("div");
  host.setAttribute("data-thewcag-notice", "");
  host.setAttribute("role", tone === "danger" ? "alert" : "status");
  host.style.cssText = "all:initial;--space-4:16px;position:fixed;right:var(--space-4);bottom:var(--space-4);z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  // This function is serialized into the page, so canonical tokens appear as
  // computed pixel equivalents (CSS Color 4 OKLCH to sRGB gamut mapping):
  // --danger oklch(0.48 0.18 27) = #AC1A1C
  // --success oklch(0.43 0.12 153) = #006130
  // --danger-soft color-mix(in oklch, var(--danger) 12%, var(--surface)) = #F4E6D1
  // --green-soft color-mix(in oklch, var(--success) 12%, var(--surface)) = #ECE6D4
  style.textContent = `
    :host {
      --elevation-0: none;
      --elevation-1: 0 1px 2px rgb(33 24 14 / 0.08), 0 6px 24px rgb(33 24 14 / 0.10);
      --motion-duration-base: 180ms;
      --motion-easing-entrance: cubic-bezier(0.23, 1, 0.32, 1);
      --radius-control: 10px;
      --danger: #AC1A1C;
      --success: #006130;
      --danger-soft: #F4E6D1;
      --green-soft: #ECE6D4;
      --space-1: 4px;
      --space-3: 12px;
      --space-4: 16px;
      --space-8: 32px;
    }
    .notice {
      border: 0;
      box-shadow: var(--elevation-1);
      animation: interaction-surface-enter var(--motion-duration-base) var(--motion-easing-entrance) both;
    }
    @keyframes interaction-surface-enter {
      from { opacity: 0; translate: 0 var(--space-1); }
      to { opacity: 1; translate: 0 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .notice {
        animation: none;
        translate: none;
      }
    }
    @media (forced-colors: active) {
      .notice {
        border: 1px solid CanvasText;
        box-shadow: var(--elevation-0);
        background: Canvas;
        color: CanvasText;
      }
    }
  `;
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.style.cssText = [
    "width:min(340px,calc(100vw - var(--space-8)))",
    "padding:var(--space-3) var(--space-4)",
    "display:grid",
    "grid-template-columns:20px minmax(0,1fr)",
    "align-items:start",
    "gap:var(--space-3)",
    "border-radius:var(--radius-control)",
    `background:${tone === "danger" ? "var(--danger-soft)" : "var(--green-soft)"}`,
    `color:${tone === "danger" ? "var(--danger)" : "var(--success)"}`,
    'font:500 13px/1.45 "Source Sans 3",system-ui,sans-serif',
    "box-sizing:border-box",
  ].join(";");
  // Phosphor fill-weight glyphs: Warning for danger, CheckCircle for success.
  const svgNamespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNamespace, "svg");
  icon.setAttribute("viewBox", "0 0 256 256");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("fill", "currentColor");
  icon.setAttribute("aria-hidden", "true");
  const iconPath = document.createElementNS(svgNamespace, "path");
  iconPath.setAttribute(
    "d",
    tone === "danger"
      ? "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"
      : "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z",
  );
  icon.append(iconPath);
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tone === "danger" ? "Capture failed" : "Evidence captured";
  title.style.cssText = "display:block;margin-bottom:var(--space-1);font-weight:700;";
  const body = document.createElement("span");
  body.textContent = message;
  copy.append(title, body);
  notice.append(icon, copy);
  shadow.append(style, notice);
  document.documentElement.append(host);
  window.setTimeout(() => host.remove(), 4_500);
}

async function notifyPage(
  tabId: number,
  tone: "success" | "danger",
  message: string,
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: showPageNotice,
    args: [tone, message],
  }).catch(() => undefined);
}

async function markAction(tabId: number, text: string, color: string): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setBadgeBackgroundColor({ tabId, color }),
  ]).catch(() => undefined);
}

async function capture(mode: "element" | "region"): Promise<ExtensionResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined) {
    return { ok: false, message: "No active website tab is available." };
  }
  if (isProtectedBrowserPage(tab.url || "")) {
    return {
      ok: false,
      message: "This browser page is protected by Chrome. Switch to a normal website and reopen TheWCAG. Localhost pages are supported.",
    };
  }
  const tabId = tab.id;
  const windowId = tab.windowId;

  const inProgress = capturePromises.get(tabId);
  if (inProgress) return inProgress;

  const capturePromise = (async (): Promise<ExtensionResponse> => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: runIssuePicker,
        args: [mode],
      });
      const selection = results[0]?.result;
      if (!selection) return { ok: false, cancelled: true, message: "Selection cancelled." };

      await new Promise((resolve) => setTimeout(resolve, 50));
      const selectedTab = await chrome.tabs.get(tabId);
      let selectedPageUrl = "";
      try {
        const selectedUrl = new URL(selectedTab.url || "");
        selectedPageUrl = `${selectedUrl.origin}${selectedUrl.pathname}`;
      } catch {
        selectedPageUrl = "";
      }
      if (
        !selectedTab.active ||
        selectedTab.windowId !== windowId ||
        selectedPageUrl !== selection.page.url
      ) {
        return {
          ok: false,
          cancelled: false,
          message: "The active tab changed before the screenshot was captured. Start the capture again on the intended page.",
        };
      }
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
      const evidence = await createEvidencePacket(selection, screenshotDataUrl);
      await chrome.storage.local.set({
        [EVIDENCE_STORAGE_KEY]: evidence,
        [CAPTURE_TAB_STORAGE_KEY]: tabId,
      });
      await chrome.storage.local.remove([DRAFT_STORAGE_KEY, QUEUED_FINDING_STORAGE_KEY, SAVED_FINDING_STORAGE_KEY]);
      if (!hasConnectedPanel(windowId)) await markAction(tabId, "1", ACTION_PIXEL_HEX);
      const iframeWarning = selection.omissions?.some((item) => /iframe inner content was not inspected/i.test(item));
      await notifyPage(
        tabId,
        "success",
        iframeWarning
          ? "Iframe selected. Its inner content was not inspected; review the visible screenshot and omission before continuing."
          : "Open TheWCAG from the toolbar to review the marked capture.",
      );
      return { ok: true, evidence };
    } catch (error) {
      const message = isStorageQuotaError(error) ? CAPTURE_TOO_LARGE_MESSAGE : pageAccessMessage(error);
      if (!hasConnectedPanel(windowId)) await markAction(tabId, "!", DANGER_PIXEL_HEX);
      await notifyPage(tabId, "danger", message);
      return { ok: false, message };
    }
  })();
  capturePromises.set(tabId, capturePromise);
  try {
    return await capturePromise;
  } finally {
    if (capturePromises.get(tabId) === capturePromise) capturePromises.delete(tabId);
  }
}

/**
 * Aborts every in-progress picker. The injected picker listens for the abort
 * message, removes its overlay, restores the cursor, and resolves as
 * cancelled, so the shared capture promise settles normally.
 */
async function cancelActivePickers(): Promise<void> {
  await Promise.all([...capturePromises.keys()].map((tabId) =>
    chrome.tabs.sendMessage(tabId, PICKER_ABORT_MESSAGE).catch(() => undefined),
  ));
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: ExtensionResponse) => void) => {
  if (!isExtensionRequest(message)) return false;
  if (message.type === "capture:cancel") {
    void cancelActivePickers().then(() => {
      sendResponse({ ok: false, cancelled: true, message: "Selection cancelled." });
    });
    return true;
  }
  void capture(message.mode).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: pageAccessMessage(error) });
  });
  return true;
});
