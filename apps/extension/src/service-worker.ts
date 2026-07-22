import { createEvidencePacket } from "./evidence";
import { isProtectedBrowserPage, pageAccessMessage } from "./page-access";
import { runIssuePicker } from "./picker";
import { isExtensionRequest, type ExtensionResponse } from "./shared/messages";
import {
  CAPTURE_TAB_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  EVIDENCE_STORAGE_KEY,
  QUEUED_FINDING_STORAGE_KEY,
} from "./shared/storage";

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);

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
  host.style.cssText = "all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const notice = document.createElement("div");
  notice.style.cssText = [
    "width:min(340px,calc(100vw - 36px))",
    "padding:12px 14px",
    "display:grid",
    "grid-template-columns:22px minmax(0,1fr)",
    "align-items:start",
    "gap:10px",
    `border:1px solid ${tone === "danger" ? "#d8a7a2" : "#b5cfc5"}`,
    "border-radius:11px",
    `background:${tone === "danger" ? "#fff5f3" : "#f2faf6"}`,
    `color:${tone === "danger" ? "#842f28" : "#205f4c"}`,
    "box-shadow:0 5px 8px rgba(31,41,51,.15)",
    "font:500 13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "box-sizing:border-box",
  ].join(";");
  const icon = document.createElement("span");
  icon.textContent = tone === "danger" ? "!" : "✓";
  icon.style.cssText = `width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:${tone === "danger" ? "#a63c32" : "#28745d"};color:#fff;font-weight:800;line-height:1;`;
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tone === "danger" ? "Capture failed" : "Evidence captured";
  title.style.cssText = "display:block;margin-bottom:2px;font-weight:750;";
  const body = document.createElement("span");
  body.textContent = message;
  copy.append(title, body);
  notice.append(icon, copy);
  shadow.append(notice);
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

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: runIssuePicker,
      args: [mode],
    });
    const selection = results[0]?.result;
    if (!selection) return { ok: false, cancelled: true, message: "Selection cancelled." };

    await new Promise((resolve) => setTimeout(resolve, 50));
    const selectedTab = await chrome.tabs.get(tab.id);
    let selectedPageUrl = "";
    try {
      const selectedUrl = new URL(selectedTab.url || "");
      selectedPageUrl = `${selectedUrl.origin}${selectedUrl.pathname}`;
    } catch {
      selectedPageUrl = "";
    }
    if (
      !selectedTab.active ||
      selectedTab.windowId !== tab.windowId ||
      selectedPageUrl !== selection.page.url
    ) {
      return {
        ok: false,
        cancelled: false,
        message: "The active tab changed before the screenshot was captured. Start the capture again on the intended page.",
      };
    }
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const evidence = await createEvidencePacket(selection, screenshotDataUrl);
    await chrome.storage.local.set({
      [EVIDENCE_STORAGE_KEY]: evidence,
      [CAPTURE_TAB_STORAGE_KEY]: tab.id,
    });
    await chrome.storage.local.remove([DRAFT_STORAGE_KEY, QUEUED_FINDING_STORAGE_KEY]);
    await markAction(tab.id, "1", "#d9480f");
    await notifyPage(tab.id, "success", "Open TheWCAG from the toolbar to review the marked capture.");
    return { ok: true, evidence };
  } catch (error) {
    const message = pageAccessMessage(error);
    await markAction(tab.id, "!", "#a63c32");
    await notifyPage(tab.id, "danger", message);
    return { ok: false, message };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: ExtensionResponse) => void) => {
  if (!isExtensionRequest(message)) return false;
  void capture(message.mode).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: pageAccessMessage(error) });
  });
  return true;
});
