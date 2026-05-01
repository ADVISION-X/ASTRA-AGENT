import { DISASTER_LINE_THRESHOLD } from "./purity-runtime-constants.js";
import { IMPORT_EXPORT_LIMITS } from "./purity-thresholds.js";
import type { PurityInventoryItem, PurityItemInput, PurityReportDraft } from "./purity-report-types.js";

export type { PurityInventoryItem, PurityItemInput, PurityReportDraft } from "./purity-report-types.js";

export const createPurityInventoryItem = ({ relativePath, lineCount, fileType, overLimitBy, primaryRole, functionsOverLimit, classMembers, importCount, crossOwnerImports, ownerBoundaries, roleMixingSignals }: PurityItemInput): PurityInventoryItem => ({
  file: relativePath,
  lines: lineCount,
  fileType,
  overLimitBy,
  primaryRole,
  functionsOverLimit,
  classMembers,
  importCount,
  crossOwnerImports,
  ownerBoundaries,
  roleMixingSignals,
  severity: lineCount > DISASTER_LINE_THRESHOLD || ownerBoundaries > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports || roleMixingSignals.length > 0 ? "DISASTER" : overLimitBy > 0 ? "BLOCKING" : "REMEDIATION",
  recommendedSplit: roleMixingSignals.length > 0 ? `Split ${fileType} by role: ${roleMixingSignals.join(", ")}.` : `Split ${fileType} by owner-local collaborators.`,
});

export const createEmptyPurityReport = (): PurityReportDraft => ({
  touchedBaselineSource: "none",
  touchedFiles: [],
  scanScope: [],
  godFileInventory: [],
  disasterFileInventory: [],
  ownerMixingInventory: [],
  oversizedTouchedFileInventory: [],
  functionOverLimitInventory: [],
  classObjectOverLimitInventory: [],
  importExportOverLimitInventory: [],
  remediationQueue: [],
  firstPhysicalSplitPlan: [],
});