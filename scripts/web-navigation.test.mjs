import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("public navigation has no root full-page loading boundary", () => {
  assert.equal(
    existsSync(join(root, "apps", "web", "app", "loading.tsx")),
    false,
    "A root app/loading.tsx replaces every route during navigation; use scoped loading states instead.",
  );
});

test("the public header does not block page rendering on an auth lookup", () => {
  const header = readFileSync(
    join(root, "apps", "web", "components", "Header.tsx"),
    "utf8",
  );
  assert.doesNotMatch(header, /from\s+["']@\/auth["']/);
  assert.doesNotMatch(header, /await\s+auth\s*\(/);
  assert.match(header, /<HeaderAccount\s*\/>/);
});
