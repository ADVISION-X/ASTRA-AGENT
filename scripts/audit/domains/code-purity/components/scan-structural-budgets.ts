import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { selectLawId } from "../../../shared/finding-utils.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-inventory.js";
import { observeTypeCheckerRelations } from "../../../shared/typechecker-observation.js";
import { scanStructuralFunctionBudgets } from "./scan-structural-function-budgets.js";
import { scanStructuralRuntimeEscapes } from "./scan-structural-runtime-escapes.js";
import { scanStructuralDependencyShape, scanStructuralFilesystemShape } from "./scan-structural-source-shape.js";
import { scanStructuralTypeEscapes } from "./scan-structural-type-escapes.js";

type StructuralBudgetScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
  nativeObservation?: string;
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
  (governedFile, collector) => {
    scanStructuralFunctionBudgets(governedFile, lawIds, collector);
    scanStructuralRuntimeEscapes(governedFile, collector, selectLawId(lawIds, "LAW-CODE-PURITY-001-V6"));
  });

export const scanStructuralFilesystemBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles,
  (governedFile, collector) => scanStructuralFilesystemShape(governedFile, lawIds, collector));

export const scanStructuralTypeBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[], nativeObservation?: string,
): StructuralBudgetScanResult => {
  const scan = scanFiles(governedFiles, (governedFile, collector) =>
    scanStructuralTypeEscapes(collector, governedFile, selectLawId(lawIds, "LAW-CODE-PURITY-001-V6")));
  const project = governedFiles[0]?.sourceFile.getProject();
  if (!project) throw new Error("TYPECHECKER_OBSERVATION_EMPTY");
  return { ...scan, nativeObservation: nativeObservation
    ?? observeTypeCheckerRelations(project, governedFiles.map((file) => file.repoPath)) };
};

export const scanStructuralDependencyBudgets = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): StructuralBudgetScanResult => scanFiles(governedFiles,
  (governedFile, collector) => scanStructuralDependencyShape(governedFile, lawIds, collector));
