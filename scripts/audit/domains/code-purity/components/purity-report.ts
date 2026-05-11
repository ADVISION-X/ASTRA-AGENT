import { pathFromRepoRoot } from "../../../core/paths.js";
import { writeJsonFile } from "../../../core/filesystem.js";
import { REPORT_PATH } from "./purity-runtime-constants.js";
import type { PurityInventoryItem, PurityReportDraft } from "./purity-metric-inspection.js";

type PurityReport = {
  generatedAt: string;
  touchedBaselineSource: string;
  touchedFiles: string[];
  scanScope: string[];
  supportInventory: PurityInventoryItem[];
};

type PurityReportValidationIssue = {
  lawId: "GRASSEYE-CODE-PURITY-002-V1" | "GRASSEYE-CODE-PURITY-011-V1" | "GRASSEYE-CODE-PURITY-013-V1";
  message: string;
};

const compareSeverity = (left: PurityInventoryItem, right: PurityInventoryItem): number => {
  const order = { DISASTER: 0, BLOCKING: 1, REMEDIATION: 2 } as const;
  const severityDelta = order[left.severity] - order[right.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return right.lines - left.lines;
};

const dedupeItems = (items: PurityInventoryItem[]): PurityInventoryItem[] => {
  const byFile = new Map<string, PurityInventoryItem>();
  for (const item of items.sort(compareSeverity)) {
    if (!byFile.has(item.file)) {
      byFile.set(item.file, item);
    }
  }
  return [...byFile.values()];
};

const hasInvalidSupportItem = (item: PurityInventoryItem): boolean =>
  item.severity.trim().length === 0 || item.recommendedSplit.trim().length === 0;

export const validatePurityReportArtifacts = (report: PurityReport): PurityReportValidationIssue[] => {
  if (report.scanScope.length === 0) {
    return [{
      lawId: "GRASSEYE-CODE-PURITY-011-V1",
      message: "Code-purity report did not record its scan scope.",
    }];
  }
  if (report.touchedBaselineSource === "none") {
    return [{
      lawId: "GRASSEYE-CODE-PURITY-002-V1",
      message: "Code-purity could not establish a touched-file baseline source.",
    }];
  }

  const issues: PurityReportValidationIssue[] = [];
  if (report.supportInventory.some(hasInvalidSupportItem)) {
    issues.push({
      lawId: "GRASSEYE-CODE-PURITY-013-V1",
      message: "Code-purity support inventory items must include severity and recommended split direction.",
    });
  }

  return issues;
};

export const finalizePurityReport = (draft: PurityReportDraft): PurityReport => {
  const supportInventory = dedupeItems([
    ...draft.disasterFileInventory,
    ...draft.godFileInventory,
    ...draft.ownerMixingInventory,
    ...draft.oversizedTouchedFileInventory,
    ...draft.functionOverLimitInventory,
    ...draft.classObjectOverLimitInventory,
    ...draft.importExportOverLimitInventory,
  ]).sort(compareSeverity);

  return {
    generatedAt: new Date().toISOString(),
    touchedBaselineSource: draft.touchedBaselineSource,
    touchedFiles: draft.touchedFiles,
    scanScope: draft.scanScope,
    supportInventory,
  };
};

export const writePurityReport = async (report: PurityReport): Promise<void> => {
  await writeJsonFile(pathFromRepoRoot(REPORT_PATH), report);
};