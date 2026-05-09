import type { Finding } from "../../../core/schema.js";
import type { PurityInventoryItem } from "./purity-report-types.js";

export type CodePurityScanSummary = {
  generatedAt: string;
  touchedBaselineSource: string;
  touchedFiles: string[];
  scanScope: string[];
  scannedFileCount: number;
  findingsCount: number;
};

export type CodePurityReportResult = {
  findings: Finding[];
};

export type CodePurityInventoryBucket =
  | "godFileInventory"
  | "disasterFileInventory"
  | "ownerMixingInventory"
  | "oversizedTouchedFileInventory"
  | "functionOverLimitInventory"
  | "classObjectOverLimitInventory"
  | "importExportOverLimitInventory";

export type CodePurityInventoryRecord = {
  bucket: CodePurityInventoryBucket;
  item: PurityInventoryItem;
};
