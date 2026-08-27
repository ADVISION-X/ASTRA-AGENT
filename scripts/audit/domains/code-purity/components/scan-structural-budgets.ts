import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { selectLawId } from "../../../shared/finding-utils.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-inventory.js";
import { scanStructuralFunctionBudgets } from "./scan-structural-function-budgets.js";
import { scanStructuralDependencyShape, scanStructuralFilesystemShape } from "./scan-structural-source-shape.js";
import { scanStructuralTypeEscapes } from "./scan-structural-type-escapes.js";

type StructuralBudgetScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
};

const scanFiles = (governedFiles: readonly GovernedFile[],
  scan: (governedFile: GovernedFile, collector: ReturnType<typeof createInventoryFindingCollector>) => void,
): StructuralBudgetScanResult => {
  const collector = createInventoryFindingCollector();
  for (const governedFile of governedFiles) scan(governedFile, collector);
  return { findings: collector.findings, inventoryItems: collector.inventoryItems };
};

export const scanStructuralAstBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles,
  (governedFile, collector) => scanStructuralFunctionBudgets(governedFile, lawIds, collector));

export const scanStructuralFilesystemBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles,
  (governedFile, collector) => scanStructuralFilesystemShape(governedFile, lawIds, collector));

export const scanStructuralTypeBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles, (governedFile, collector) =>
  scanStructuralTypeEscapes(collector, governedFile, selectLawId(lawIds, "LAW-CODE-PURITY-001-V5")));

export const scanStructuralDependencyBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles,
  (governedFile, collector) => scanStructuralDependencyShape(governedFile, lawIds, collector));
