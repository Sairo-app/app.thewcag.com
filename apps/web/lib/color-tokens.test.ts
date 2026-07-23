import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type Oklch = readonly [lightness: number, chroma: number, hue: number];

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const desktopStyles = readFileSync(new URL("../../desktop/src/styles.css", import.meta.url), "utf8");
const extensionStyles = readFileSync(new URL("../../extension/src/sidepanel/styles.css", import.meta.url), "utf8");
const pickerSource = readFileSync(new URL("../../extension/src/picker.ts", import.meta.url), "utf8");
const serviceWorkerSource = readFileSync(new URL("../../extension/src/service-worker.ts", import.meta.url), "utf8");
const designDocument = readFileSync(new URL("../../../DESIGN.md", import.meta.url), "utf8");
const auditExportSource = readFileSync(new URL("../../desktop/src/app/audit-export.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../auth.ts", import.meta.url), "utf8");
const openGraphSource = readFileSync(new URL("../app/opengraph-image.tsx", import.meta.url), "utf8");
const surfaces = [styles, desktopStyles, extensionStyles];
const typeSteps = [
  "caption",
  "footnote",
  "callout",
  "body",
  "headline",
  "title-3",
  "title-2",
  "title-1",
  "large-title",
  "display",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const webComponentFiles = ["../app", "../components"]
  .flatMap((directory) => sourceFiles(fileURLToPath(new URL(directory, import.meta.url))));
const desktopComponentFiles = sourceFiles(fileURLToPath(new URL("../../desktop/src", import.meta.url)));
const extensionComponentFiles = sourceFiles(fileURLToPath(new URL("../../extension/src", import.meta.url)));
const componentFiles = [...webComponentFiles, ...desktopComponentFiles, ...extensionComponentFiles];

const webComponentSource = webComponentFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const desktopComponentSource = desktopComponentFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const extensionComponentSource = extensionComponentFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const materialSources = [
  ...surfaces,
  webComponentSource,
  desktopComponentSource,
  extensionComponentSource,
  pickerSource,
  serviceWorkerSource,
];

function canonicalCss(source: string, commentStyle: "css" | "html" = "css") {
  const start = commentStyle === "css"
    ? "/* canonical-design-tokens:start */"
    : "<!-- canonical-design-tokens:start -->";
  const end = commentStyle === "css"
    ? "/* canonical-design-tokens:end */"
    : "<!-- canonical-design-tokens:end -->";
  const marked = source.slice(source.indexOf(start) + start.length, source.indexOf(end));
  const root = marked.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) throw new Error("Missing canonical design-token block");
  return root[1].replace(/\r\n?/g, "\n").trim();
}

function readOklchToken(name: string): Oklch {
  const match = styles.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`));
  if (!match) throw new Error(`Missing --${name} OKLCH token`);

  const values = match[1].trim().split(/\s+/).map(Number);
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid --${name} OKLCH token`);
  }

  return values as unknown as Oklch;
}

function toLinearSrgb([lightness, chroma, hue]: Oklch) {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.max(0, Math.min(1, channel)));
}

function relativeLuminance(color: Oklch) {
  const [red, green, blue] = toLinearSrgb(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: Oklch, second: Oklch) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function declarationValues(source: string, property: string) {
  return [...source.matchAll(new RegExp(`(?<![-\\w])${property}\\s*:\\s*([^;]+);`, "g"))]
    .map((match) => match[1].trim());
}

function spacingDeclarationValues(source: string) {
  return [...source.matchAll(/(?<![-\w])(?:padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap)\s*:\s*([^;]+);/g)]
    .map((match) => match[1].trim());
}

function hoverRuleBodies(source: string) {
  return [...source.matchAll(/[^{}]*:hover[^{}]*\{([^{}]*)\}/g)]
    .map((match) => match[1]);
}

function unlabeledIconOnlyButtons(file: string) {
  const source = readFileSync(file, "utf8");
  const syntax = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, syntax);
  const iconNames = new Set<string>();
  const failures: number[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!/(?:^|\/)Icon$|(?:^|\/)icons$/.test(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) iconNames.add(element.name.text);
  }

  const tagName = (node: ts.JsxOpeningLikeElement) => node.tagName.getText(sourceFile);
  const hasIcon = (node: ts.Node) => {
    let found = false;
    const visit = (child: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child))
        && iconNames.has(tagName(child))
      ) found = true;
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return found;
  };
  const hasVisibleContent = (node: ts.JsxElement): boolean => node.children.some((child): boolean => {
    if (ts.isJsxText(child)) return Boolean(child.text.trim());
    if (ts.isJsxExpression(child)) return Boolean(child.expression);
    if (ts.isJsxElement(child) && /^[a-z]/.test(tagName(child.openingElement))) {
      return hasVisibleContent(child);
    }
    return false;
  });

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && tagName(node.openingElement) === "button" && hasIcon(node) && !hasVisibleContent(node)) {
      const names = new Set(node.openingElement.attributes.properties.flatMap((attribute) =>
        ts.isJsxAttribute(attribute) ? [attribute.name.getText(sourceFile)] : []));
      if (!names.has("aria-label") && !names.has("aria-labelledby")) {
        failures.push(sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return failures;
}

describe("canonical design tokens", () => {
  const cream = readOklchToken("on-orange");

  it("keeps every surface and DESIGN.md on the verbatim canonical block", () => {
    const canonical = canonicalCss(styles);
    expect(canonicalCss(desktopStyles)).toBe(canonical);
    expect(canonicalCss(extensionStyles)).toBe(canonical);
    expect(canonicalCss(designDocument, "html")).toBe(canonical);
  });

  it("keeps desktop and extension presentation colors on canonical roles", () => {
    const hexColor = /#[\da-f]{3,8}\b/i;
    expect(desktopStyles).not.toMatch(hexColor);
    expect(extensionStyles).not.toMatch(hexColor);
    expect(pickerSource).not.toMatch(hexColor);
  });

  it("keeps canonical panel and control radii instead of local variants", () => {
    const localPanelOrControlRadius = /border-radius:\s*(?:8|9|10|11|12|13|14|15|16|20)px/;
    expect(styles).not.toMatch(localPanelOrControlRadius);
    expect(desktopStyles).not.toMatch(localPanelOrControlRadius);
    expect(extensionStyles).not.toMatch(localPanelOrControlRadius);
  });

  it("retains focus and forced-colors support on every surface", () => {
    for (const surface of surfaces) {
      expect(surface).toContain(":focus-visible");
      expect(surface).toContain("@media (forced-colors: active)");
    }
  });

  it("defines the complete size-driven type ramp", () => {
    const canonical = canonicalCss(styles);
    for (const step of typeSteps) {
      expect(canonical).toMatch(new RegExp(`--type-${step}-size:`));
      expect(canonical).toMatch(new RegExp(`--type-${step}-line:`));
      expect(canonical).toMatch(new RegExp(`--type-${step}-tracking:`));
    }

    const tracking = typeSteps.map((step) => {
      const match = canonical.match(new RegExp(`--type-${step}-tracking:\\s*(-?[\\d.]+)em`));
      if (!match) throw new Error(`Missing tracking token for ${step}`);
      return Number(match[1]);
    });
    expect(tracking[0]).toBeCloseTo(0.01);
    expect(tracking.at(-1)).toBeCloseTo(-0.04);
    expect(tracking.every((value, index) => index === 0 || value <= tracking[index - 1])).toBe(true);
  });

  it("uses ramp tokens for all CSS typography declarations", () => {
    const stepPattern = typeSteps.join("|");
    for (const surface of surfaces) {
      for (const value of declarationValues(surface, "font-size")) {
        expect(value).toMatch(new RegExp(`^(?:var\\(--type-(?:${stepPattern})-size\\)|inherit)$`));
      }
      for (const value of declarationValues(surface, "line-height")) {
        expect(value).toMatch(new RegExp(`^var\\(--type-(?:${stepPattern})-line\\)$`));
      }
      for (const value of declarationValues(surface, "letter-spacing")) {
        expect(value).toMatch(new RegExp(`^var\\(--type-(?:${stepPattern})-tracking\\)$`));
      }
    }
  });

  it("has no ad-hoc tracking or typography-related important declarations", () => {
    const typographyImportant = /(?:font-(?:size|family|weight|style|variant|feature-settings)|line-height|letter-spacing|text-wrap|text-align|text-transform)\s*:[^;]*!important/;
    for (const source of [...surfaces, auditExportSource, authSource, openGraphSource]) {
      expect(source).not.toMatch(typographyImportant);
      expect(source).not.toMatch(/letterSpacing\s*:/);
    }
    expect(auditExportSource).not.toMatch(/letter-spacing\s*:/);
    expect(authSource).not.toMatch(/letter-spacing\s*:/);
    expect(webComponentSource).not.toMatch(/\btracking-(?:tight|wide|wider|widest|normal|\[)/);
    expect(webComponentSource).not.toMatch(/\bleading-(?:none|tight|snug|normal|relaxed|loose|\[)/);
    expect(webComponentSource).not.toMatch(/\b(?:text|[a-z-]+:text)-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?:8|9|10|11)px\])/);
  });

  it("keeps wrapping, measure, and numeric typography rules on every surface", () => {
    for (const surface of surfaces) {
      expect(surface).toContain("text-wrap: balance");
      expect(surface).toContain("text-wrap: pretty");
      expect(surface).toContain("72ch");
      expect(surface).toContain("tabular-nums lining-nums");
      expect(surface).toContain('"tnum" 1, "lnum" 1');
    }
  });

  it("defines the canonical spacing, density, and control scale", () => {
    const canonical = canonicalCss(styles);
    const spaces = new Map([
      ["1", "4px"],
      ["2", "8px"],
      ["3", "12px"],
      ["4", "16px"],
      ["5", "20px"],
      ["6", "24px"],
      ["8", "32px"],
      ["10", "40px"],
      ["12", "48px"],
    ]);
    for (const [step, value] of spaces) {
      expect(canonical).toContain(`--space-${step}: ${value};`);
    }
    expect(canonical).toContain("--control-height-compact: 36px;");
    expect(canonical).toContain("--control-height-standard: 44px;");
    expect(canonical).toContain("--card-padding: var(--space-5);");
    expect(canonical).toContain("--rhythm-editorial: var(--space-8);");
    expect(canonical).toContain("--rhythm-marketing: var(--space-12);");
    expect(canonical).toContain("--rhythm-product: var(--space-4);");
    expect(canonical).toContain("--rhythm-admin: var(--space-3);");
  });

  it("routes CSS spacing declarations through the shared grid", () => {
    for (const source of [...surfaces, auditExportSource]) {
      for (const value of spacingDeclarationValues(source)) {
        const withoutTechnicalExceptions = value
          .replace(/(?:-1|-2|0)px\b/g, "")
          .replace(/\d+(?:\.\d+)?mm\b/g, "");
        expect(withoutTechnicalExceptions).not.toMatch(/-?(?:\d+\.?\d*|\.\d+)(?:px|rem)\b/);
      }
    }
    expect(pickerSource).toContain("padding:var(--space-1) var(--space-2)");
    expect(serviceWorkerSource).toContain('"padding:var(--space-3) var(--space-4)"');
    expect(serviceWorkerSource).toContain('"gap:var(--space-3)"');
  });

  it("keeps web spacing utilities on supported grid steps", () => {
    const supported = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "10", "12"]);
    const utilities = webComponentSource.matchAll(
      /(?<![\w-])(?:[a-z]+:)*(?:p[trblxy]?|m[trblxy]?|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.5)?)(?![\w.-])/g,
    );
    for (const utility of utilities) {
      expect(supported.has(utility[1]), utility[0]).toBe(true);
    }
  });

  it("preserves the standard interactive target on every surface", () => {
    for (const surface of surfaces) {
      expect(surface).toContain("min-block-size: var(--control-height-standard) !important");
    }
    expect(styles).toContain(".site-footer a");
    expect(extensionStyles).toContain("footer a");
  });

  it("defines one canonical motion and focus system", () => {
    const canonical = canonicalCss(styles);
    expect(canonical).toContain("--motion-duration-fast: 120ms;");
    expect(canonical).toContain("--motion-duration-base: 180ms;");
    expect(canonical).toContain("--motion-easing-entrance: cubic-bezier(0.23, 1, 0.32, 1);");
    expect(canonical).toContain("--motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);");
    expect(canonical).toContain("--focus-ring-width: 2px;");
    expect(canonical).toContain("--focus-halo-width: 3px;");
    expect(canonical).toContain("--focus-halo-shadow:");
  });

  it("routes component transitions and entrances through motion tokens", () => {
    for (const surface of surfaces) {
      for (const value of declarationValues(surface, "transition")) {
        expect(value).not.toMatch(/\b\d+(?:\.\d+)?m?s\b/);
        expect(value).not.toMatch(/\bcubic-bezier\(|\bease(?:-in|-out|-in-out)?\b/);
        expect(value).toContain("var(--motion-");
      }
      expect(surface).not.toMatch(/animation\s*:[^;]*\binfinite\b/);
      expect(surface).toContain("animation: interaction-surface-enter var(--motion-duration-base) var(--motion-easing-entrance) both");
      expect(surface).toMatch(/\[role="tab"\]/);
      expect(surface).toMatch(/details\[open\]/);
      expect(surface).toMatch(/dialog\[open\]/);
      expect(surface).toMatch(/\[popover\]:popover-open/);
    }
    expect(desktopStyles).toContain(".toast");
    expect(extensionStyles).toContain(".status");
    expect(serviceWorkerSource).toContain("--motion-duration-base: 180ms");
    expect(serviceWorkerSource).toContain("var(--motion-easing-entrance)");
  });

  it("keeps hover feedback spatially stable and pressed feedback consistent", () => {
    for (const surface of surfaces) {
      for (const body of hoverRuleBodies(surface)) {
        expect(body).not.toMatch(/(?:transform|translate|scale|rotate)\s*:/);
        expect(body).not.toMatch(/(?:margin|padding|inset|top|right|bottom|left|width|height)\s*:/);
      }
      for (const scale of surface.matchAll(/scale\(([^)]+)\)/g)) {
        expect(scale[1]).toBe("0.98");
      }
      expect(surface).toContain("transform var(--motion-duration-fast) var(--motion-easing-standard)");
    }
  });

  it("uses the same focus ring, halo, and forced-colors fallback", () => {
    for (const surface of surfaces) {
      expect(surface).toContain("outline: var(--focus-ring-width) solid var(--focus-ring-color)");
      expect(surface).toContain("box-shadow: var(--focus-halo-shadow)");
      expect(surface).toContain("outline: 2px solid Highlight !important");
      expect(surface).toContain("box-shadow: var(--elevation-0) !important");
    }
  });

  it("removes entrance translation and pressed scaling for reduced motion", () => {
    for (const surface of surfaces) {
      const reduced = surface.slice(surface.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
      expect(reduced).toContain("animation: none !important");
      expect(reduced).toContain("translate: none !important");
      expect(reduced).toContain("transform: none !important");
      expect(reduced).toContain("transition-property: color, background-color, border-color, opacity, box-shadow !important");
      expect(reduced).not.toMatch(/transition-property:[^;]*(?:transform|translate)/);
    }
    expect(desktopStyles).toContain('html[data-motion="reduced"]');
  });

  it("routes every UI glyph through the canonical Phosphor wrappers", () => {
    const wrappers = componentFiles.filter((file) => /[\\/]Icon\.tsx$/.test(file));
    expect(wrappers).toHaveLength(3);
    for (const file of componentFiles) {
      const source = readFileSync(file, "utf8");
      if (wrappers.includes(file)) {
        expect(source).toContain('@phosphor-icons/react');
        expect(source).toContain('color="currentColor"');
        expect(source).toContain('aria-hidden={isDecorative ? true : undefined}');
        expect(source).toContain('role={isDecorative ? undefined : "img"}');
      } else {
        expect(source, file).not.toContain('@phosphor-icons/react');
      }
    }
    expect(webComponentSource.replace(readFileSync(new URL("../components/icons.tsx", import.meta.url), "utf8"), "")).not.toMatch(/<svg\b/);
  });

  it("uses only the four icon sizes and permitted weights", () => {
    const source = [webComponentSource, desktopComponentSource, extensionComponentSource].join("\n");
    for (const match of source.matchAll(/\bsize=\{(\d+)\}/g)) {
      expect([16, 20, 24, 32], match[0]).toContain(Number(match[1]));
    }
    expect(source).not.toMatch(/weight="(?:bold|thin|light)"/);
    for (const match of source.matchAll(/<([A-Z][\w.]*)\b[^>]*\bweight="fill"/g)) {
      expect(["CheckCircle", "Warning", "WarningCircle"], match[0]).toContain(match[1]);
    }
    const duotone = [...source.matchAll(/<([A-Z][\w.]*)\b([^>]*)\bweight="duotone"/g)];
    expect(duotone).toHaveLength(1);
    expect(duotone[0][0]).toContain("size={32}");
  });

  it("keeps icon-only controls named and icons visible in forced colors", () => {
    for (const file of componentFiles.filter((entry) => entry.endsWith(".tsx"))) {
      expect(unlabeledIconOnlyButtons(file), file).toEqual([]);
    }
    for (const surface of surfaces) {
      expect(surface).toContain(".ui-icon");
      expect(surface).toContain("forced-color-adjust: auto");
    }
  });

  it("defines the restrained three-level elevation and hairline scale", () => {
    const canonical = canonicalCss(styles);
    expect(canonical).toContain("--hairline: 1px solid var(--line);");
    expect(canonical).toContain("--hairline-strong: 1px solid var(--line-strong);");
    expect(canonical).toContain("--elevation-0: none;");
    expect(canonical).toContain("--elevation-1: 0 1px 2px");
    expect(canonical).toContain("0 6px 24px");
    expect(canonical).toContain("--elevation-2: 0 2px 4px");
    expect(canonical).toContain("0 18px 48px");
    expect(canonical).not.toMatch(/--(?:shadow|elevation)-(?:menu|preview|small):/);
  });

  it("uses only flat materials and elevation tokens", () => {
    for (const source of materialSources) {
      expect(source).not.toMatch(/(?:linear|radial|conic)-gradient\s*\(/);
      expect(source).not.toMatch(/(?:text-shadow|drop-shadow)\s*[:(]/);
      for (const value of declarationValues(source, "box-shadow")) {
        expect(value).toMatch(/^var\(--(?:elevation-[012]|focus-halo-shadow)\)(?:\s*!important)?$/);
      }
    }
  });

  it("reserves elevation two for one primary preview per full application surface", () => {
    const elevationTwoCount = (source: string) =>
      source.match(/box-shadow:\s*var\(--elevation-2\)/g)?.length ?? 0;

    expect(elevationTwoCount(styles)).toBe(1);
    expect(elevationTwoCount(desktopStyles)).toBe(1);
    expect(elevationTwoCount(extensionStyles)).toBe(0);
    expect(elevationTwoCount(pickerSource)).toBe(0);
    expect(elevationTwoCount(serviceWorkerSource)).toBe(0);
  });

  it("keeps elevated surfaces borderless until forced colors restores an edge", () => {
    const elevatedBlock = /[^{}]+\{([^{}]*box-shadow:\s*var\(--elevation-[12]\)[^{}]*)\}/g;
    for (const source of materialSources) {
      for (const match of source.matchAll(elevatedBlock)) {
        const borderValues = [
          ...match[1].matchAll(/(?<![-\w])border(?!-radius)(?:-[\w-]+)?\s*:\s*([^;]+);/g),
        ].map((border) => border[1].trim());
        expect(borderValues.every((value) => value === "0")).toBe(true);
      }
    }

    for (const source of surfaces) {
      expect(source).toContain("--elevation-1: none");
      expect(source).toContain("--elevation-2: none");
      expect(source).toContain("border: 1px solid CanvasText");
    }
  });

  it("keeps cream text accessible on the primary orange", () => {
    expect(contrastRatio(cream, readOklchToken("action"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps cream text accessible on the orange hover state", () => {
    expect(contrastRatio(cream, readOklchToken("action-hover"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["action-text", "canvas"],
    ["action-text", "surface"],
    ["body", "surface"],
    ["muted", "surface"],
  ] as const)("keeps %s accessible on %s", (foreground, background) => {
    expect(contrastRatio(readOklchToken(foreground), readOklchToken(background))).toBeGreaterThanOrEqual(4.5);
  });
});
