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

export type PurityItemInput = {
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