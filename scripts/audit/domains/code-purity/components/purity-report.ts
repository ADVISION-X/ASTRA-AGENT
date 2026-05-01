import { pathFromRepoRoot } from "../../../core/paths.js";
import { writeJsonFile } from "../../../core/filesystem.js";
import { REPORT_PATH } from "./purity-runtime-constants.js";
import type { PurityInventoryItem, PurityReportDraft } from "./purity-metric-inspection.js";

export type PurityReport = {
  generatedAt: string;
  touchedBaselineSource: string;
  touchedFiles: string[];
  scanScope: string[];
  godFileInventory: PurityInventoryItem[];
  disasterFileInventory: PurityInventoryItem[];
  ownerMixingInventory: PurityInventoryItem[];
  oversizedTouchedFileInventory: PurityInventoryItem[];
  functionOverLimitInventory: PurityInventoryItem[];
  classObjectOverLimitInventory: PurityInventoryItem[];
  importExportOverLimitInventory: PurityInventoryItem[];
  remediationQueue: PurityInventoryItem[];
  firstPhysicalSplitPlan: PurityInventoryItem[];
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

export const finalizePurityReport = (draft: PurityReportDraft): PurityReport => {
  const remediationQueue = dedupeItems([
    ...draft.disasterFileInventory,
    ...draft.godFileInventory,
    ...draft.ownerMixingInventory,
    ...draft.functionOverLimitInventory,
    ...draft.classObjectOverLimitInventory,
    ...draft.importExportOverLimitInventory,
  ]).sort(compareSeverity);

  return {
    generatedAt: new Date().toISOString(),
    ...draft,
    remediationQueue,
    firstPhysicalSplitPlan: remediationQueue.slice(0, 5),
  };
};

export const writePurityReport = async (report: PurityReport): Promise<void> => {
  await writeJsonFile(pathFromRepoRoot(REPORT_PATH), report);
};