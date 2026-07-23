import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./header-actions", () => ({ signOutFromHeader: vi.fn() }));

import { HeaderAccount } from "./HeaderAccount";

describe("header account", () => {
  it("renders a fixed account placeholder before the client session resolves", () => {
    const markup = renderToStaticMarkup(createElement(HeaderAccount));

    expect(markup).toContain("header-account-skeleton");
    expect(markup).toContain("Loading account status");
    expect(markup).not.toContain("Sign in");
  });
});
