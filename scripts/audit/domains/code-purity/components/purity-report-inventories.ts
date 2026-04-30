import { DISASTER_LINE_THRESHOLD, IMPORT_EXPORT_LIMITS } from "./purity-constants.js";
import type { PurityInventoryItem, PurityReportDraft } from "./purity-report-draft.js";

type InventoryBucket = keyof Pick<
  PurityReportDraft,
  | "godFileInventory"
  | "disasterFileInventory"
  | "ownerMixingInventory"
  | "oversizedTouchedFileInventory"
  | "functionOverLimitInventory"
  | "classObjectOverLimitInventory"
  | "importExportOverLimitInventory"
>;

const pushInventoryItem = (
  report: PurityReportDraft,
  bucket: InventoryBucket,
  item: PurityInventoryItem,
  shouldAdd: boolean,
): void => {
  if (shouldAdd) {
    report[bucket].push(item);
  }
};

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
  const {
    report,
    item,
    touchedPaths,
    relativePath,
    lineCount,
    hardLimit,
    functionOverLimit,
    classOverLimit,
    importDeclarations,
    importSources,
    exportCount,
    crossOwnerImports,
    importedOwners,
    roleMixingSignals,
  } = input;

  pushInventoryItem(report, "godFileInventory", item, lineCount > hardLimit);
  pushInventoryItem(
    report,
    "disasterFileInventory",
    item,
    lineCount > DISASTER_LINE_THRESHOLD
      || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports
      || importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries
      || roleMixingSignals.length > 0,
  );
  pushInventoryItem(
    report,
    "ownerMixingInventory",
    item,
    importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports,
  );
  pushInventoryItem(report, "oversizedTouchedFileInventory", item, touchedPaths.has(relativePath) && lineCount > hardLimit);
  pushInventoryItem(report, "functionOverLimitInventory", item, functionOverLimit.length > 0);
  pushInventoryItem(report, "classObjectOverLimitInventory", item, classOverLimit.length > 0);
  pushInventoryItem(
    report,
    "importExportOverLimitInventory",
    item,
    importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations
      || importSources > IMPORT_EXPORT_LIMITS.importSources
      || exportCount > IMPORT_EXPORT_LIMITS.exports,
  );
};