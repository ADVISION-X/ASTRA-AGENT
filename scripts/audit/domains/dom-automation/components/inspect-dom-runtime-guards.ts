import type { SourceFile } from "ts-morph";

import { sourceFileByRepoPath, hasIdentifier, hasSourceToken, type DomFindingCollector } from "./dom-inspector-support.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";

type RuntimeGuard = {
  checkId: string;
  filePath: string;
  lawId: string;
  requiredIdentifiers?: readonly string[];
  requiredStringLiterals?: readonly string[];
  message: string;
};

const runtimeGuards: readonly RuntimeGuard[] = [
  {
    checkId: "dom/structured-locate-result",
    filePath: "src/capabilities/dom-automation/runtime/dom-locator.ts",
    lawId: "APEX-DOM-003-V1",
    requiredIdentifiers: ["locateDomElementResultOnce", "DOM_SCHEMAS"],
    requiredStringLiterals: ["not_found", "ambiguous", "review_required"],
    message: "DOM locator must expose structured not_found, ambiguous, and review_required results.",
  },
  {
    checkId: "dom/upload-approved-path-and-file-input",
    filePath: "src/capabilities/dom-automation/runtime/dom-upload.ts",
    lawId: "APEX-DOM-009-V1",
    requiredIdentifiers: ["validateApprovedUploadRequest", "approvedTaskFilePath"],
    requiredStringLiterals: ["file-input"],
    message: "DOM upload must enforce task-approved path equality and file-input target kind.",
  },
  {
    checkId: "dom/click-sensitive-review-gate",
    filePath: "src/capabilities/dom-automation/runtime/dom-click.ts",
    lawId: "APEX-DOM-008-V1",
    requiredIdentifiers: ["DANGEROUS_TEXT", "buildDomReviewRequiredResult"],
    requiredStringLiterals: ["expected text did not match"],
    message: "DOM click must gate sensitive text and expected-text mismatch as review_required.",
  },
  {
    checkId: "dom/scroll-budget-and-revalidation",
    filePath: "src/capabilities/dom-automation/runtime/dom-scroll.ts",
    lawId: "APEX-DOM-014-V1",
    requiredIdentifiers: ["DOM_SCHEMAS", "captureDomEvidenceRef"],
    requiredStringLiterals: ["maxSteps", "maxPixels", "element-not-reachable-by-scroll"],
    message: "DOM scroll must require located ref, bounded budget, evidence, and viewport revalidation.",
  },
  {
    checkId: "dom/select-native-custom-verification",
    filePath: "src/capabilities/dom-automation/runtime/dom-select.ts",
    lawId: "APEX-DOM-015-V1",
    requiredIdentifiers: ["DOM_SCHEMAS", "approvedOptionList"],
    requiredStringLiterals: ["selection-not-reflected", "[role='option']"],
    message: "DOM select must handle native/custom dropdowns and verify reflected selection.",
  },
  {
    checkId: "dom/dismiss-safe-allowlist",
    filePath: "src/capabilities/dom-automation/runtime/dom-dismiss-overlay.ts",
    lawId: "APEX-DOM-016-V1",
    requiredIdentifiers: ["SAFE_OVERLAY_TYPES", "DANGEROUS_DISMISSAL_TEXT"],
    requiredStringLiterals: ["overlay-type-not-in-safe-dismissal-allowlist", "overlay-still-present"],
    message: "DOM overlay dismissal must use safe allowlist, dangerous text gate, and disappearance verification.",
  },
];

const inspectGuard = (sourceFile: SourceFile, guard: RuntimeGuard, collector: DomFindingCollector): void => {
  for (const identifier of guard.requiredIdentifiers ?? []) {
    if (hasIdentifier(sourceFile, identifier)) continue;
    collector.push({
      checkId: guard.checkId,
      lawId: guard.lawId,
      filePath: guard.filePath,
      evidence: identifier,
      message: guard.message,
    });
  }
  for (const literal of guard.requiredStringLiterals ?? []) {
    if (hasSourceToken(sourceFile, literal)) continue;
    collector.push({
      checkId: guard.checkId,
      lawId: guard.lawId,
      filePath: guard.filePath,
      evidence: literal,
      message: guard.message,
    });
  }
};

export const inspectDomRuntimeGuards = (context: InspectorContext, collector: DomFindingCollector): void => {
  for (const guard of runtimeGuards) {
    const sourceFile = sourceFileByRepoPath(context.project, guard.filePath);
    if (!sourceFile) {
      collector.push({
        checkId: guard.checkId,
        lawId: guard.lawId,
        filePath: guard.filePath,
        message: `${guard.filePath} is missing and cannot satisfy ${guard.checkId}.`,
      });
      continue;
    }
    inspectGuard(sourceFile, guard, collector);
  }
};
