import { afterEach, describe, expect, it, vi } from "vitest";
import { runIssuePicker } from "./picker";

class FakeShadowRoot {
  hit: FakeElement[] = [];
  children: FakeElement[] = [];

  append(...elements: FakeElement[]) {
    this.children.push(...elements);
  }

  elementsFromPoint() {
    return this.hit;
  }

  elementFromPoint() {
    return this.hit[0] ?? null;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly attributes: Array<{ name: string; value: string }> = [];
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  shadowRoot: FakeShadowRoot | null = null;
  textContent = "";
  tabIndex = -1;
  removed = false;
  isContentEditable = false;
  private readonly attributeValues = new Map<string, string>();
  private bounds = { x: 10, y: 10, top: 10, width: 80, height: 30 };

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  get childNodes() {
    return [
      ...(this.textContent ? [{ nodeType: 3, textContent: this.textContent }] : []),
      ...this.children,
    ];
  }

  setAttribute(name: string, value: string) {
    this.attributeValues.set(name, value);
    const existing = this.attributes.find((attribute) => attribute.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
    if (name === "contenteditable") this.isContentEditable = value.toLowerCase() !== "false";
  }

  getAttribute(name: string) {
    return this.attributeValues.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributeValues.has(name);
  }

  attachShadow(init: ShadowRootInit) {
    const root = new FakeShadowRoot();
    if (init.mode === "open") this.shadowRoot = root;
    return root;
  }

  append(...elements: FakeElement[]) {
    for (const element of elements) {
      element.parentElement = this;
      this.children.push(element);
    }
  }

  contains(element: FakeElement) {
    return this.children.includes(element);
  }

  remove() {
    this.removed = true;
  }

  closest() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  matches(selector: string) {
    return selector === "input,textarea,select"
      ? ["INPUT", "TEXTAREA", "SELECT"].includes(this.tagName)
      : false;
  }

  getBoundingClientRect() {
    return { ...this.bounds, right: this.bounds.x + this.bounds.width, bottom: this.bounds.y + this.bounds.height };
  }

  scrollIntoView() {}
}

class FakeInputElement extends FakeElement {
  type = "text";
  value = "";

  constructor() {
    super("input");
  }

  override setAttribute(name: string, value: string) {
    super.setAttribute(name, value);
    if (name === "type") this.type = value;
  }
}

type Listener = (event: Record<string, unknown>) => void;

function pickerHarness(existingPicker = false) {
  const listeners = new Map<string, Set<Listener>>();
  const documentElement = new FakeElement("html");
  const body = new FakeElement("body");
  let hit: FakeElement[] = [];
  const elementsById = new Map<string, FakeElement>();
  const documentMock = {
    title: "Checkout",
    documentElement,
    body,
    activeElement: null,
    querySelector: (selector: string) => selector === "[data-thewcag-picker]" && existingPicker
      ? new FakeElement("div")
      : null,
    querySelectorAll: () => [],
    getElementById: (id: string) => elementsById.get(id) ?? null,
    createElement: (tagName: string) => new FakeElement(tagName),
    elementsFromPoint: () => hit,
    elementFromPoint: () => hit[0] ?? null,
    addEventListener: (type: string, listener: Listener) => {
      const entries = listeners.get(type) ?? new Set<Listener>();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener: (type: string, listener: Listener) => listeners.get(type)?.delete(listener),
  };

  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("window", { setTimeout });
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("HTMLInputElement", FakeInputElement);
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.stubGlobal("location", { href: "https://example.com/checkout?secret=1", origin: "https://example.com" });
  vi.stubGlobal("navigator", { language: "en", userAgent: "Test browser" });
  vi.stubGlobal("visualViewport", { width: 1280, height: 720, scale: 1, offsetLeft: 0, offsetTop: 0 });
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 720);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 1; });
  vi.stubGlobal("getComputedStyle", () => ({
    display: "block",
    visibility: "visible",
    getPropertyValue: () => "",
  }));

  return {
    setHit(elements: FakeElement[]) {
      hit = elements;
    },
    setElementById(id: string, element: FakeElement) {
      elementsById.set(id, element);
    },
    dispatch(type: string, values: Record<string, unknown> = {}) {
      const event = {
        clientX: 20,
        clientY: 20,
        key: "",
        shiftKey: false,
        defaultPrevented: false,
        propagationStopped: false,
        immediateStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        stopImmediatePropagation() { this.immediateStopped = true; },
        ...values,
      };
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
      return event;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("issue picker interactions", () => {
  it("short-circuits when a picker overlay already exists", async () => {
    pickerHarness(true);
    await expect(runIssuePicker("element")).resolves.toBeNull();
  });

  it("suppresses element pointer and mouse activation events", async () => {
    const harness = pickerHarness();
    const result = runIssuePicker("element");

    expect(harness.dispatch("pointerdown").immediateStopped).toBe(true);
    expect(harness.dispatch("mousedown").immediateStopped).toBe(true);
    expect(harness.dispatch("pointerup").immediateStopped).toBe(true);
    expect(harness.dispatch("mouseup").immediateStopped).toBe(true);
    harness.dispatch("keydown", { key: "Escape" });
    await expect(result).resolves.toBeNull();
  });

  it("keeps mouse and click blockers through the synthesized region click", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    harness.setHit([new FakeElement("a")]);
    const result = runIssuePicker("region");

    harness.dispatch("pointerdown", { clientX: 10, clientY: 10 });
    harness.dispatch("pointermove", { clientX: 40, clientY: 40 });
    harness.dispatch("pointerup", { clientX: 40, clientY: 40 });
    expect(harness.dispatch("mouseup").immediateStopped).toBe(true);
    expect(harness.dispatch("click").immediateStopped).toBe(true);
    await expect(result).resolves.toMatchObject({ target: { tagName: "a" } });

    vi.runAllTimers();
    expect(harness.dispatch("click").immediateStopped).toBe(false);
  });

  it("selects the deepest element in an open shadow root", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    const shadowHost = new FakeElement("checkout-control");
    const root = shadowHost.attachShadow({ mode: "open" });
    const button = new FakeElement("button");
    button.textContent = "Pay now";
    root.hit = [button];
    harness.setHit([shadowHost]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    await expect(result).resolves.toMatchObject({ target: { tagName: "button", accessibleName: "Pay now" } });
    vi.runAllTimers();
  });

  it("uses aria-labelledby before aria-label", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    const label = new FakeElement("span");
    label.textContent = "Referenced checkout action";
    harness.setElementById("checkout-label", label);
    const button = new FakeElement("button");
    button.setAttribute("aria-labelledby", "checkout-label");
    button.setAttribute("aria-label", "Lower precedence label");
    harness.setHit([button]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    await expect(result).resolves.toMatchObject({
      target: { accessibleName: "Referenced checkout action" },
    });
    vi.runAllTimers();
  });

  it("uses an input placeholder only as an accessible-name fallback", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    const input = new FakeInputElement();
    input.setAttribute("placeholder", "Work email");
    harness.setHit([input]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    await expect(result).resolves.toMatchObject({
      target: {
        accessibleName: "Work email",
        attributes: { placeholder: "Work email" },
      },
    });
    vi.runAllTimers();
  });

  it.each(["", "plaintext-only"])("does not collect contenteditable=%s text", async (value) => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    const editable = new FakeElement("div");
    editable.setAttribute("contenteditable", value);
    editable.textContent = "Private user-authored note";
    harness.setHit([editable]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    const selection = await result;
    expect(selection?.target.accessibleName).toBe("");
    expect(selection?.target.domExcerpt).not.toContain("Private user-authored note");
    vi.runAllTimers();
  });

  it("excludes editable descendants from accessible-name and excerpt text", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    const button = new FakeElement("button");
    button.textContent = "Submit";
    const editable = new FakeElement("span");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = "Private draft";
    button.append(editable);
    harness.setHit([button]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    const selection = await result;
    expect(selection?.target.accessibleName).toBe("Submit");
    expect(selection?.target.domExcerpt).toContain("Submit");
    expect(selection?.target.domExcerpt).not.toContain("Private draft");
    vi.runAllTimers();
  });

  it("warns and records an omission when an iframe is selected", async () => {
    vi.useFakeTimers();
    const harness = pickerHarness();
    harness.setHit([new FakeElement("iframe")]);
    const result = runIssuePicker("element");

    harness.dispatch("pointermove");
    harness.dispatch("click");
    const selection = await result;
    expect(selection?.target.tagName).toBe("iframe");
    expect(selection?.omissions).toContainEqual(expect.stringMatching(/inner content was not inspected/i));
    vi.runAllTimers();
  });
});
