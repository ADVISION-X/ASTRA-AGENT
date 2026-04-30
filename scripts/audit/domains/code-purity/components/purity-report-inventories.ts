import { DISASTER_LINE_THRESHOLD } from "./purity-runtime-constants.js";
import { IMPORT_EXPORT_LIMITS } from "./purity-thresholds.js";
import type { PurityInventoryItem, PurityReportDraft } from "./purity-report-types.js";

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

const buildInventoryChecks = (input: {
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
}): Array<[InventoryBucket, boolean]> => [
  ["godFileInventory", input.lineCount > input.hardLimit],
  [
    "disasterFileInventory",
    input.lineCount > DISASTER_LINE_THRESHOLD
      || input.crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports
      || input.importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries
      || input.roleMixingSignals.length > 0,
  ],
  [
    "ownerMixingInventory",
    input.importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries
      || input.crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports,
  ],
  ["oversizedTouchedFileInventory", input.touchedPaths.has(input.relativePath) && input.lineCount > input.hardLimit],
  ["functionOverLimitInventory", input.functionOverLimit.length > 0],
  ["classObjectOverLimitInventory", input.classOverLimit.length > 0],
  [
    "importExportOverLimitInventory",
    input.importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations
      || input.importSources > IMPORT_EXPORT_LIMITS.importSources
      || input.exportCount > IMPORT_EXPORT_LIMITS.exports,
  ],
];

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

  const inventoryChecks = buildInventoryChecks({
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
  });

  for (const [bucket, shouldAdd] of inventoryChecks) {
    pushInventoryItem(report, bucket, item, shouldAdd);
  }
};