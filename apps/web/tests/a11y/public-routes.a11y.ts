import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  isAxeSignalTriaged,
  validateAxeTriageAllowlist,
  type A11yScanProfile,
  type AxeSignalIdentity,
} from "../../a11y/triage";
import { A11Y_SCAN_REPORT_SLUG } from "../../lib/a11y-scan-fixture";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const allowlistJson: unknown = JSON.parse(readFileSync(
  new URL("../../a11y/axe-allowlist.json", import.meta.url),
  "utf8",
));
const allowlist = validateAxeTriageAllowlist(allowlistJson);

const ROUTES = [
  "/",
  "/getting-started",
  "/download",
  "/pricing",
  "/wcag-contrast",
  "/wcag-checklist",
  `/s/${A11Y_SCAN_REPORT_SLUG}`,
] as const;

const WCAG_A_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

interface AxeNodeSignal {
  target: unknown[];
  html: string;
  failureSummary?: string;
}

interface AxeViolationSignal {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: AxeNodeSignal[];
}

interface AxeRunSignals {
  violations: AxeViolationSignal[];
  incomplete: AxeViolationSignal[];
}

function targetIdentity(target: unknown[]): string {
  return JSON.stringify(target);
}

function formatSignal(
  signal: AxeSignalIdentity &
    Pick<AxeNodeSignal, "failureSummary"> &
    Pick<AxeViolationSignal, "impact" | "help" | "helpUrl">,
): string {
  return [
    `${signal.ruleId} (${signal.impact ?? "impact unknown"})`,
    `route=${signal.route}`,
    `profile=${signal.profile}`,
    `target=${signal.target}`,
    signal.help,
    signal.failureSummary ?? "",
    signal.helpUrl,
  ].filter(Boolean).join(" | ");
}

for (const route of ROUTES) {
  test(`automated WCAG A/AA signals: ${route}`, async ({ page }, testInfo) => {
    const response = await page.goto(route, { waitUntil: "load" });
    expect(response?.ok(), `Built route ${route} did not return a successful response.`).toBe(true);
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.addScriptTag({ path: axePath });

    const result = await page.evaluate(async (tags): Promise<AxeRunSignals> => {
      const axe = (window as unknown as {
        axe: { run: (root: Document, options: unknown) => Promise<AxeRunSignals> };
      }).axe;
      return axe.run(document, {
        runOnly: { type: "tag", values: tags },
        resultTypes: ["violations", "incomplete"],
      });
    }, WCAG_A_AA_TAGS);

    const profile = testInfo.project.name as A11yScanProfile;
    const untriaged: string[] = [];
    let triagedCount = 0;
    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        const identity: AxeSignalIdentity = {
          ruleId: violation.id,
          route,
          profile,
          target: targetIdentity(node.target),
        };
        if (isAxeSignalTriaged(identity, allowlist)) {
          triagedCount += 1;
        } else {
          untriaged.push(formatSignal({
            ...identity,
            failureSummary: node.failureSummary,
            impact: violation.impact,
            help: violation.help,
            helpUrl: violation.helpUrl,
          }));
        }
      }
    }

    console.log(
      `[accessibility signal] ${profile} ${route}: ${untriaged.length} untriaged A/AA violation signals, ${triagedCount} triaged, ${result.incomplete.length} manual-review signals. This is not a conformance claim.`,
    );
    expect(
      untriaged,
      `Automated accessibility signals only — not a conformance claim.\n${untriaged.join("\n")}`,
    ).toEqual([]);
  });
}
