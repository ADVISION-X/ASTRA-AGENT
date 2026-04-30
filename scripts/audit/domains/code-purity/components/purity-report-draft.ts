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

export const appendItemToInventories = (input: {
  report: PurityReportDraft;
  item: PurityInventoryItem;
  touchedPaths: Set<string>;
  relativePath: string;
  lineCount: number;
  hardLimit: number;
  functionOverLimit: string[];
  classOverLimit: string[];
  importDeclarations: number;
  importSources: number;
  exportCount: number;
  crossOwnerImports: number;
  importedOwners: string[];
  roleMixingSignals: string[];
}): void => {
  const { report, item, touchedPaths, relativePath, lineCount, hardLimit, functionOverLimit, classOverLimit, importDeclarations, importSources, exportCount, crossOwnerImports, importedOwners, roleMixingSignals } = input;

  if (lineCount > hardLimit) {
    report.godFileInventory.push(item);
  }
  if (lineCount > DISASTER_LINE_THRESHOLD || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports || importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || roleMixingSignals.length > 0) {
    report.disasterFileInventory.push(item);
  }
  if (importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports) {
    report.ownerMixingInventory.push(item);
  }
  if (touchedPaths.has(relativePath) && lineCount > hardLimit) {
    report.oversizedTouchedFileInventory.push(item);
  }
  if (functionOverLimit.length > 0) {
    report.functionOverLimitInventory.push(item);
  }
  if (classOverLimit.length > 0) {
    report.classObjectOverLimitInventory.push(item);
  }
  if (importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations || importSources > IMPORT_EXPORT_LIMITS.importSources || exportCount > IMPORT_EXPORT_LIMITS.exports) {
    report.importExportOverLimitInventory.push(item);
  }
};