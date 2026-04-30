import { DISASTER_LINE_THRESHOLD, IMPORT_EXPORT_LIMITS } from "./purity-constants.js";

export interface PurityInventoryItem {
  file: string;
  lines: number;
  fileType: string;
  overLimitBy: number;
  functionsOverLimit: string[];
  classMembers: number;
  importCount: number;
  crossOwnerImports: number;
  ownerBoundaries: number;
  roleMixingSignals: string[];
  severity: "BLOCKING" | "DISASTER" | "REMEDIATION";
  recommendedSplit: string;
}

export interface PurityReportDraft {
  godFileInventory: PurityInventoryItem[];
  disasterFileInventory: PurityInventoryItem[];
  ownerMixingInventory: PurityInventoryItem[];
  oversizedTouchedFileInventory: PurityInventoryItem[];
  functionOverLimitInventory: PurityInventoryItem[];
  classObjectOverLimitInventory: PurityInventoryItem[];
  importExportOverLimitInventory: PurityInventoryItem[];
  remediationQueue: PurityInventoryItem[];
  firstPhysicalSplitPlan: PurityInventoryItem[];
}

type PurityItemInput = {
  relativePath: string;
  lineCount: number;
  fileType: string;
  overLimitBy: number;
  functionsOverLimit: string[];
  classMembers: number;
  importCount: number;
  crossOwnerImports: number;
  ownerBoundaries: number;
  roleMixingSignals: string[];
};

export const createPurityInventoryItem = ({ relativePath, lineCount, fileType, overLimitBy, functionsOverLimit, classMembers, importCount, crossOwnerImports, ownerBoundaries, roleMixingSignals }: PurityItemInput): PurityInventoryItem => ({
  file: relativePath,
  lines: lineCount,
  fileType,
  overLimitBy,
  functionsOverLimit,
  classMembers,
  importCount,
  crossOwnerImports,
  ownerBoundaries,
  roleMixingSignals,
  severity: lineCount > DISASTER_LINE_THRESHOLD || ownerBoundaries > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports ? "DISASTER" : overLimitBy > 0 ? "BLOCKING" : "REMEDIATION",
  recommendedSplit: roleMixingSignals.length > 0 ? `Split ${fileType} by role: ${roleMixingSignals.join(", ")}.` : `Split ${fileType} by owner-local collaborators.`,
});

export const createEmptyPurityReport = (): PurityReportDraft => ({
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