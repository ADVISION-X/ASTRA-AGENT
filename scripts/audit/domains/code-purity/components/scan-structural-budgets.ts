import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-report-writer.js";
import { scanStructuralFunctionBudgets } from "./scan-structural-function-budgets.js";
import { scanStructuralSourceShape } from "./scan-structural-source-shape.js";

type StructuralBudgetScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
};

export const scanStructuralBudgets = (governedFiles: readonly GovernedFile[], lawIds: readonly string[]): StructuralBudgetScanResult => {
  const collector = createInventoryFindingCollector();

  for (const governedFile of governedFiles) {
    scanStructuralSourceShape(governedFile, lawIds, collector);
    scanStructuralFunctionBudgets(governedFile, lawIds, collector);
  }

  return { findings: collector.findings, inventoryItems: collector.inventoryItems };
};