import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("public navigation has an accessible root loading shell", () => {
  const loadingPath = join(root, "apps", "web", "app", "loading.tsx");
  assert.equal(existsSync(loadingPath), true, "The dynamic application needs a root loading boundary.");

  const loading = readFileSync(loadingPath, "utf8");
  const loadingShell = readFileSync(
    join(root, "apps", "web", "components", "AppPageLoading.tsx"),
    "utf8",
  );
  assert.match(loading, /<AppPageLoading\s*\/>/);
  assert.match(loadingShell, /role=["']status["']/);
  assert.match(loadingShell, /aria-live=["']polite["']/);
  assert.match(loadingShell, /<Header\s*\/>/);
  assert.match(loadingShell, /<Footer\s*\/>/);
  assert.doesNotMatch(loadingShell, /from\s+["']@\/auth["']/);
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
