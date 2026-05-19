import { existsSync, readFileSync } from "node:fs";
import { createFinding } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";

type CheckSpec = {
  lawId: string;
  file: string;
  message: string;
  hint: string;
  tokens: string[];
};

function finding(spec: CheckSpec): Finding {
  return createFinding({
    lawId: spec.lawId,
    file: spec.file,
    line: 1,
    severity: "fatal",
    message: spec.message,
    hint: spec.hint,
  });
}

function hasAll(file: string, tokens: string[]): boolean {
  if (!existsSync(pathFromRepoRoot(file))) return false;
  const text = readFileSync(pathFromRepoRoot(file), "utf8");
  return tokens.every((token) => text.includes(token));
}

function check(spec: CheckSpec): Finding[] {
  return hasAll(spec.file, spec.tokens) ? [] : [finding(spec)];
}

export function closedLoopFindings(): Finding[] {
  const specs: CheckSpec[] = [
    {
      lawId: "GRASSEYE-DOM-001-V1",
      file: "src/capabilities/dom-automation/contracts/dom-snapshot.contract.ts",
      message: "DOM contracts directory is incomplete",
      hint: "Keep contract exports under the DOM owner contracts directory.",
      tokens: ["DomSnapshot"],
    },
    {
      lawId: "GRASSEYE-DOM-007-V1",
      file: "src/capabilities/dom-automation/runtime/dom-wait.ts",
      message: "DOM wait does not refresh active-page DOM",
      hint: "Call readDomSnapshotOnce inside the bounded wait loop before verifyDomStateOnce.",
      tokens: ["readDomSnapshotOnce", "while", "verifyDomStateOnce"],
    },
    {
      lawId: "GRASSEYE-DOM-003-V1",
      file: "src/capabilities/dom-automation/runtime/dom-locator.ts",
      message: "DOM locator does not support row and text candidates",
      hint: "Use tableRows, roleRows, textBlocks, and genericClickableElements in locator candidates.",
      tokens: ["tableRows", "roleRows", "textBlocks", "genericClickableElements"],
    },
    {
      lawId: "GRASSEYE-DOM-010-V1",
      file: "src/capabilities/dom-automation/runtime/dom-fill.ts",
      message: "DOM fill lacks before/after evidence refs",
      hint: "Capture screenshot evidence before and after the DOM fill action.",
      tokens: ["beforeEvidenceRef", "afterEvidenceRef", "captureDomEvidenceRef"],
    },
    {
      lawId: "GRASSEYE-DOM-010-V1",
      file: "src/capabilities/dom-automation/runtime/dom-click.ts",
      message: "DOM click lacks before/after evidence refs",
      hint: "Capture screenshot evidence before and after the DOM click action.",
      tokens: ["beforeEvidenceRef", "afterEvidenceRef", "captureDomEvidenceRef"],
    },
    {
      lawId: "GRASSEYE-DOM-001-V1",
      file: "src/muscle-memory/catalog-merge.ts",
      message: "catalog merge lacks duplicate guards",
      hint: "Fail fast on duplicate actionCode and abilityGroupId/childCapabilityId keys.",
      tokens: ["mergeCapabilityCatalogEntries", "actionCode", "abilityGroupId", "childCapabilityId", "throw new Error"],
    },
    {
      lawId: "GRASSEYE-DOM-002-V1",
      file: "scripts/acceptance/dom-automation-smoke.ts",
      message: "DOM smoke does not execute real active-page DOM evaluation",
      hint: "Use Playwright local page plus readDomSnapshotOnce instead of returning a handbuilt snapshot.",
      tokens: ["chromium.launch", "PlaywrightDomBrowserAdapter", "readDomSnapshotOnce", "waitForDomStateOnce"],
    },
    {
      lawId: "GRASSEYE-DOM-008-V1",
      file: "scripts/acceptance/amazon-invoice-upload-smoke.ts",
      message: "Amazon smoke does not execute plugin dry-run flow",
      hint: "Run runAmazonInvoiceUploadPhaseOne against a local page and assert review_required.",
      tokens: ["runAmazonInvoiceUploadPhaseOne", "review_required", "upload invoice entry located"],
    },
  ];
  return specs.flatMap(check);
}
