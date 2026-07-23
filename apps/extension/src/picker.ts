import type { EvidenceCaptureMode, EvidencePageV1, EvidenceTargetV1 } from "@accessibility-build/audit-contracts";
import type { CapturedSelection } from "./shared/messages";

/**
 * This function is serialized by chrome.scripting.executeScript. Keep every
 * runtime helper inside the function so it has no closure dependencies.
 */
export async function runIssuePicker(mode: EvidenceCaptureMode): Promise<CapturedSelection | null> {
  type Rect = { x: number; y: number; width: number; height: number };

  if (document.querySelector("[data-thewcag-picker]")) return null;

  const cleanText = (value: string | null | undefined, max: number): string =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  const isEditableContent = (element: Element): boolean =>
    Boolean((element as HTMLElement).isContentEditable);

  const subtreeText = (element: Element): string => {
    if (isEditableContent(element) || element.matches("input,textarea,select")) return "";
    const chunks: string[] = [];
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3) chunks.push(node.textContent || "");
      else if (node.nodeType === 1) chunks.push(subtreeText(node as Element));
    }
    return chunks.join(" ");
  };

  const implicitRole = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "img") return "img";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "reset", "image"].includes(type)) return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "range") return "slider";
      return "textbox";
    }
    const landmark = ["main", "nav", "aside", "header", "footer", "form"].includes(tag) ? tag : "";
    return landmark;
  };

  const referencedText = (element: Element, attribute: string): string => {
    const ids = (element.getAttribute(attribute) || "").split(/\s+/).filter(Boolean).slice(0, 8);
    return cleanText(ids.map((id) => {
      const referenced = document.getElementById(id);
      return referenced ? subtreeText(referenced) : "";
    }).join(" "), 500);
  };

  const labelsFor = (element: Element): string[] => {
    const labels = new Set<string>();
    const id = element.getAttribute("id");
    if (id) {
      for (const label of document.querySelectorAll("label")) {
        if (label.htmlFor === id) {
          const value = cleanText(subtreeText(label), 500);
          if (value) labels.add(value);
        }
      }
    }
    const wrapping = element.closest("label");
    if (wrapping) {
      const value = cleanText(subtreeText(wrapping), 500);
      if (value) labels.add(value);
    }
    const ariaLabelled = referencedText(element, "aria-labelledby");
    if (ariaLabelled) labels.add(ariaLabelled);
    return [...labels].slice(0, 20);
  };

  const accessibleName = (element: Element, labels: string[]): string => {
    const labelledBy = referencedText(element, "aria-labelledby");
    if (labelledBy) return labelledBy;
    const aria = cleanText(element.getAttribute("aria-label"), 500);
    if (aria) return aria;
    if (labels.length) return labels.join(" ").slice(0, 500);
    const alt = cleanText(element.getAttribute("alt"), 500);
    if (alt) return alt;
    if (element instanceof HTMLInputElement) {
      const type = (element.type || "text").toLowerCase();
      if (["button", "submit", "reset"].includes(type)) {
        const value = cleanText(element.value, 500);
        if (value) return value;
        if (type === "submit") return "Submit";
        if (type === "reset") return "Reset";
      }
    }
    const content = cleanText([
      subtreeText(element),
      ...Array.from(element.querySelectorAll("img[alt]"))
        .filter((image) => !isEditableContent(image))
        .map((image) => image.getAttribute("alt")),
      ...Array.from(element.querySelectorAll("svg[aria-label]"))
        .filter((image) => !isEditableContent(image))
        .map((image) => image.getAttribute("aria-label")),
    ].filter(Boolean).join(" "), 500);
    if (content) return content;
    if (element instanceof HTMLInputElement) {
      const placeholder = cleanText(element.getAttribute("placeholder"), 500);
      if (placeholder) return placeholder;
    }
    return cleanText(element.getAttribute("title"), 500);
  };

  const cssEscape = (value: string): string => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  };

  const selectorFor = (element: Element): string => {
    const id = element.getAttribute("id");
    if (id && document.querySelectorAll(`#${cssEscape(id)}`).length === 1) return `#${cssEscape(id)}`;
    const testAttribute = ["data-testid", "data-test", "data-cy"].find((name) => element.hasAttribute(name));
    if (testAttribute) {
      const value = element.getAttribute(testAttribute) || "";
      const candidate = `[${testAttribute}="${value.replace(/["\\]/g, "\\$&")}"]`;
      try {
        if (document.querySelectorAll(candidate).length === 1) return candidate;
      } catch {
        // Fall through to a structural selector for unusual attribute values.
      }
    }
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.documentElement && parts.length < 7) {
      let part = current.tagName.toLowerCase();
      const parentElement: Element | null = current.parentElement;
      if (parentElement) {
        const same = [...parentElement.children].filter((child) => child.tagName === current!.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parentElement;
    }
    return parts.join(" > ").slice(0, 1_000);
  };

  const structuralPathFor = (element: Element): string => {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && parts.length < 10) {
      let part = current.tagName.toLowerCase();
      if (current.id) part += `#${cssEscape(current.id)}`;
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ").slice(0, 1_000);
  };

  const safeAttributes = (element: Element): Record<string, string> => {
    const allowed = new Set([
      "id", "class", "role", "type", "name", "for", "alt", "tabindex", "disabled", "required",
      "checked", "selected", "multiple", "readonly", "aria-label", "aria-labelledby",
      "aria-describedby", "aria-expanded", "aria-checked", "aria-selected", "aria-current",
      "aria-disabled", "aria-required", "aria-invalid", "aria-hidden", "placeholder", "title",
      "data-testid", "data-test", "data-cy",
    ]);
    const output: Record<string, string> = {};
    for (const attribute of [...element.attributes].slice(0, 80)) {
      if (!allowed.has(attribute.name)) continue;
      output[attribute.name] = cleanText(attribute.value, 1_000);
    }
    if (element.hasAttribute("href")) {
      try {
        const url = new URL(element.getAttribute("href") || "", location.href);
        output.href = `${url.origin}${url.pathname}`.slice(0, 1_000);
      } catch {
        output.href = "";
      }
    }
    return output;
  };

  const relevantStyles = (element: Element): Record<string, string> => {
    const computed = getComputedStyle(element);
    const names = [
      "display", "visibility", "opacity", "color", "background-color", "font-size", "font-weight",
      "line-height", "text-decoration", "outline", "outline-color", "outline-width", "border-color",
      "cursor", "pointer-events", "position", "overflow", "white-space",
    ];
    return Object.fromEntries(names.map((name) => [name, cleanText(computed.getPropertyValue(name), 300)]));
  };

  const statesFor = (element: Element): string[] => {
    const output = new Set<string>();
    const html = element as HTMLElement;
    if (html.tabIndex >= 0) output.add("focusable");
    if (html === document.activeElement) output.add("focused");
    for (const name of ["disabled", "required", "checked", "selected", "readonly", "multiple"]) {
      if (element.hasAttribute(name)) output.add(name);
    }
    for (const name of ["expanded", "checked", "selected", "current", "disabled", "required", "invalid", "hidden"]) {
      const value = element.getAttribute(`aria-${name}`);
      if (value) output.add(`aria-${name}=${cleanText(value, 60)}`);
    }
    return [...output].slice(0, 40);
  };

  const nearbyHeading = (element: Element): string => {
    const targetTop = element.getBoundingClientRect().top;
    let nearest = "";
    let distance = Number.POSITIVE_INFINITY;
    for (const heading of document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")) {
      const rect = heading.getBoundingClientRect();
      if (rect.top > targetTop + 4) continue;
      const nextDistance = targetTop - rect.top;
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = cleanText(subtreeText(heading), 500);
      }
    }
    return nearest;
  };

  const landmarkFor = (element: Element): string => {
    const landmark = element.closest("main,nav,aside,header,footer,form,[role=main],[role=navigation],[role=complementary],[role=banner],[role=contentinfo],[role=form],[role=search]");
    if (!landmark) return "";
    return cleanText(landmark.getAttribute("role") || landmark.tagName.toLowerCase(), 120);
  };

  const excerptFor = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    const attributes = safeAttributes(element);
    const serialized = Object.entries(attributes)
      .map(([key, value]) => `${key}="${value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] || character)}"`)
      .join(" ");
    const text = isEditableContent(element) || element.matches("input,textarea,select")
      ? ""
      : cleanText(subtreeText(element), 1_000);
    return `<${tag}${serialized ? ` ${serialized}` : ""}>${text}</${tag}>`.slice(0, 12_000);
  };

  const rectValue = (rect: DOMRect | Rect): Rect => ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.max(1, Math.round(rect.width * 100) / 100),
    height: Math.max(1, Math.round(rect.height * 100) / 100),
  });

  const targetFor = (element: Element, bounds: Rect, kind: EvidenceCaptureMode): EvidenceTargetV1 => {
    const labels = labelsFor(element);
    const role = cleanText(element.getAttribute("role"), 80) || implicitRole(element);
    return {
      kind,
      tagName: element.tagName.toLowerCase(),
      role,
      accessibleName: accessibleName(element, labels),
      accessibleDescription: referencedText(element, "aria-describedby"),
      selector: selectorFor(element),
      structuralPath: structuralPathFor(element),
      bounds,
      marker: bounds,
      states: statesFor(element),
      labels,
      nearbyHeading: nearbyHeading(element),
      landmark: landmarkFor(element),
      attributes: safeAttributes(element),
      styles: relevantStyles(element),
      domExcerpt: excerptFor(element),
    };
  };

  const pageFor = (): EvidencePageV1 => ({
    title: cleanText(document.title, 300),
    url: (() => {
      try {
        const url = new URL(location.href);
        return `${url.origin}${url.pathname}`.slice(0, 2_048);
      } catch {
        return "";
      }
    })(),
    origin: location.origin.slice(0, 255),
    locale: cleanText(document.documentElement.lang || navigator.language, 40),
    browser: cleanText(navigator.userAgent, 120),
    viewport: {
      width: visualViewport?.width ?? innerWidth,
      height: visualViewport?.height ?? innerHeight,
      devicePixelRatio: devicePixelRatio || 1,
      visualScale: visualViewport?.scale ?? 1,
      offsetLeft: visualViewport?.offsetLeft ?? 0,
      offsetTop: visualViewport?.offsetTop ?? 0,
    },
  });

  return new Promise<CapturedSelection | null>((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-thewcag-picker", "");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --elevation-0: none;
        --elevation-1: 0 1px 2px rgb(33 24 14 / 0.08), 0 6px 24px rgb(33 24 14 / 0.10);
        --space-1: 4px;
        --space-2: 8px;
      }
      .picker-label { box-shadow: var(--elevation-1); }
      @media (forced-colors: active) {
        .picker-label {
          border: 1px solid CanvasText;
          box-shadow: var(--elevation-0);
        }
      }
    `;
    const outline = document.createElement("div");
    const label = document.createElement("div");
    const veil = document.createElement("div");
    outline.style.cssText = "position:fixed;display:none;border:3px solid oklch(0.52 0.18 42);border-radius:10px;background:color-mix(in oklch,oklch(0.52 0.18 42) 9%,transparent);box-sizing:border-box;pointer-events:none;";
    label.className = "picker-label";
    label.style.cssText = "position:fixed;display:none;max-width:280px;padding:var(--space-1) var(--space-2);border-radius:10px;background:oklch(0.215 0.034 54);color:oklch(0.98 0.014 85);font:600 12px/1.35 Manrope,system-ui,sans-serif;pointer-events:none;";
    veil.style.cssText = "position:fixed;inset:0;background:transparent;pointer-events:none;cursor:crosshair;";
    shadow.append(style, veil, outline, label);
    document.documentElement.append(host);

    const elementAtPoint = (
      root: Document | ShadowRoot,
      x: number,
      y: number,
    ): Element | null => {
      const candidates = typeof root.elementsFromPoint === "function"
        ? root.elementsFromPoint(x, y)
        : [root.elementFromPoint(x, y)].filter((element): element is Element => Boolean(element));
      for (const candidate of candidates) {
        if (candidate === host || host.contains(candidate)) continue;
        if (candidate.shadowRoot) {
          const nested = elementAtPoint(candidate.shadowRoot, x, y);
          if (nested) return nested;
        }
        return candidate;
      }
      return null;
    };

    const iframeOmission = "Iframe inner content was not inspected; only the iframe element and visible screenshot were captured";

    let hovered: Element | null = null;
    const keyboardCandidates = Array.from(document.querySelectorAll(
      "a[href],button,input:not([type='hidden']),select,textarea,[tabindex]:not([tabindex='-1']),[role]",
    )).filter((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    let keyboardIndex = document.activeElement
      ? keyboardCandidates.indexOf(document.activeElement)
      : -1;
    let dragStart: { x: number; y: number } | null = null;
    let dragRect: Rect | null = null;
    let finished = false;
    const originalCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";

    const removeActionBlockers = () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp, true);
    };

    const cleanup = (deferActionBlockers = false) => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("keydown", onKeyDown, true);
      if (deferActionBlockers) window.setTimeout(removeActionBlockers, 0);
      else removeActionBlockers();
      document.documentElement.style.cursor = originalCursor;
      host.remove();
    };

    const placeOutline = (rect: Rect, text: string) => {
      outline.style.display = "block";
      outline.style.left = `${Math.max(0, rect.x)}px`;
      outline.style.top = `${Math.max(0, rect.y)}px`;
      outline.style.width = `${Math.max(1, rect.width)}px`;
      outline.style.height = `${Math.max(1, rect.height)}px`;
      label.textContent = text;
      label.style.display = "block";
      label.style.left = `${Math.max(8, Math.min(innerWidth - 288, rect.x))}px`;
      label.style.top = `${rect.y > 38 ? rect.y - 34 : Math.min(innerHeight - 34, rect.y + rect.height + 8)}px`;
    };

    const finish = (element: Element, bounds: Rect) => {
      if (finished) return;
      finished = true;
      const target = targetFor(element, bounds, mode);
      const iframeSelected = element.tagName.toLowerCase() === "iframe";
      cleanup(true);
      resolve({
        page: pageFor(),
        target,
        ...(iframeSelected ? { omissions: [iframeOmission] } : {}),
      });
    };

    const highlightKeyboardCandidate = (direction: 1 | -1) => {
      if (!keyboardCandidates.length) return;
      keyboardIndex = (keyboardIndex + direction + keyboardCandidates.length) % keyboardCandidates.length;
      const element = keyboardCandidates[keyboardIndex];
      element.scrollIntoView({ block: "center", inline: "nearest" });
      hovered = element;
      requestAnimationFrame(() => {
        const rect = rectValue(element.getBoundingClientRect());
        const role = element.getAttribute("role") || implicitRole(element) || element.tagName.toLowerCase();
        placeOutline(rect, `Keyboard selection · ${element.tagName.toLowerCase()}${role ? ` · ${role}` : ""}`);
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (mode === "region" && dragStart) {
        const x = Math.min(dragStart.x, event.clientX);
        const y = Math.min(dragStart.y, event.clientY);
        dragRect = { x, y, width: Math.abs(event.clientX - dragStart.x), height: Math.abs(event.clientY - dragStart.y) };
        placeOutline(dragRect, `${Math.round(dragRect.width)} × ${Math.round(dragRect.height)}`);
        event.preventDefault();
        return;
      }
      if (mode !== "element") return;
      const element = elementAtPoint(document, event.clientX, event.clientY);
      if (!element) return;
      hovered = element;
      const rect = rectValue(element.getBoundingClientRect());
      const role = element.getAttribute("role") || implicitRole(element) || element.tagName.toLowerCase();
      const iframeWarning = element.tagName.toLowerCase() === "iframe" ? " · inner content not inspected" : "";
      placeOutline(rect, `${element.tagName.toLowerCase()}${role ? ` · ${role}` : ""}${iframeWarning}`);
    };

    const blockPageAction = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onMouseDown = (event: MouseEvent) => blockPageAction(event);
    const onMouseUp = (event: MouseEvent) => blockPageAction(event);

    const onPointerDown = (event: PointerEvent) => {
      blockPageAction(event);
      if (mode !== "region") return;
      dragStart = { x: event.clientX, y: event.clientY };
      dragRect = { x: event.clientX, y: event.clientY, width: 1, height: 1 };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (mode === "element") {
        blockPageAction(event);
        return;
      }
      if (mode !== "region" || !dragStart || !dragRect) return;
      blockPageAction(event);
      const bounds = rectValue(dragRect);
      dragStart = null;
      if (bounds.width < 8 || bounds.height < 8) {
        dragRect = null;
        outline.style.display = "none";
        label.style.display = "none";
        return;
      }
      const centerX = Math.min(innerWidth - 1, Math.max(0, bounds.x + bounds.width / 2));
      const centerY = Math.min(innerHeight - 1, Math.max(0, bounds.y + bounds.height / 2));
      const element = elementAtPoint(document, centerX, centerY) || document.body;
      finish(element, bounds);
    };

    const onClick = (event: MouseEvent) => {
      blockPageAction(event);
      if (finished || mode !== "element") return;
      const element = hovered || elementAtPoint(document, event.clientX, event.clientY);
      if (!element) return;
      finish(element, rectValue(element.getBoundingClientRect()));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        blockPageAction(event);
        cleanup();
        resolve(null);
        return;
      }
      if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp") {
        blockPageAction(event);
        highlightKeyboardCandidate(event.shiftKey || event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (event.key === "Enter") {
        const element = hovered || document.activeElement;
        if (element && element !== document.body && element !== document.documentElement && element !== host) {
          blockPageAction(event);
          finish(element, rectValue(element.getBoundingClientRect()));
        }
      }
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}
