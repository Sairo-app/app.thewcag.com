import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { Toast } from "./components";

function renderToast(message: Parameters<typeof Toast>[0]["message"]) {
  return new JSDOM(
    renderToStaticMarkup(createElement(Toast, { message })),
  ).window.document;
}

describe("Toast live regions", () => {
  it("keeps polite and assertive live regions mounted while idle", () => {
    const document = renderToast(null);

    expect(document.querySelector('[role="status"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.querySelector(".toast")).toBeNull();
  });

  it("routes success and error copy to separate live regions", () => {
    const success = renderToast({ text: "Finding created", error: false });
    expect(success.querySelector('[role="status"]')?.textContent).toBe(
      "Finding created",
    );
    expect(success.querySelector('[role="alert"]')?.textContent).toBe("");

    const error = renderToast({
      title: "Share failed",
      text: "Try again",
      error: true,
    });
    expect(error.querySelector('[role="status"]')?.textContent).toBe("");
    expect(error.querySelector('[role="alert"]')?.textContent).toBe(
      "Share failed. Try again",
    );
  });
});
