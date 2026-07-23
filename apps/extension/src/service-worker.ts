import { createEvidencePacket } from "./evidence";
import { isProtectedBrowserPage, pageAccessMessage } from "./page-access";
import { runIssuePicker } from "./picker";
import {
  isExtensionRequest,
  isPanelPortMessage,
  PANEL_PORT_NAME,
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

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);

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
    else void markAction(message.tabId, "", "#d9480f");
  });
  port.onDisconnect.addListener(() => detachPanelPort(port));
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});

function showPageNotice(tone: "success" | "danger", message: string): void {
  document.querySelector("[data-thewcag-notice]")?.remove();
  const host = document.createElement("div");
  host.setAttribute("data-thewcag-notice", "");
  host.setAttribute("role", tone === "danger" ? "alert" : "status");
  host.style.cssText = "all:initial;--space-4:16px;position:fixed;right:var(--space-4);bottom:var(--space-4);z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --elevation-0: none;
      --elevation-1: 0 1px 2px rgb(33 24 14 / 0.08), 0 6px 24px rgb(33 24 14 / 0.10);
      --motion-duration-base: 180ms;
      --motion-easing-entrance: cubic-bezier(0.23, 1, 0.32, 1);
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
      }
    }
  `;
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.style.cssText = [
    "width:min(340px,calc(100vw - var(--space-8)))",
    "padding:var(--space-3) var(--space-4)",
    "display:grid",
    "grid-template-columns:22px minmax(0,1fr)",
    "align-items:start",
    "gap:var(--space-3)",
    "border-radius:11px",
    `background:${tone === "danger" ? "#fff5f3" : "#f2faf6"}`,
    `color:${tone === "danger" ? "#842f28" : "#205f4c"}`,
    "font:500 13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "box-sizing:border-box",
  ].join(";");
  const icon = document.createElement("span");
  icon.textContent = tone === "danger" ? "!" : "✓";
  icon.style.cssText = `width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:${tone === "danger" ? "#a63c32" : "#28745d"};color:#fff;font-weight:800;line-height:1;`;
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tone === "danger" ? "Capture failed" : "Evidence captured";
  title.style.cssText = "display:block;margin-bottom:var(--space-1);font-weight:750;";
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
      if (!hasConnectedPanel(windowId)) await markAction(tabId, "1", "#d9480f");
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
      if (!hasConnectedPanel(windowId)) await markAction(tabId, "!", "#a63c32");
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: ExtensionResponse) => void) => {
  if (!isExtensionRequest(message)) return false;
  void capture(message.mode).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: pageAccessMessage(error) });
  });
  return true;
});
