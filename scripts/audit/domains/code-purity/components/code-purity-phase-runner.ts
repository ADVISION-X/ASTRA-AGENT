import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { collectCodePurityGovernedFiles } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-inventory.js";
import { scanOwnerBoundaries } from "./scan-owner-boundaries.js";
import { scanStructuralBudgets } from "./scan-structural-budgets.js";
import { scanZombieSurfaces, type ZombieScanSummary } from "./scan-zombie-surfaces.js";

type CodePurityPhaseRun = {
  findings: InspectorFinding[];
  inspectedFiles: string[];
  inventoryItems: CodePurityInventoryItem[];
  summary: ZombieScanSummary;
};

const dedupeFindings = (findings: readonly InspectorFinding[]): InspectorFinding[] => {
  const byKey = new Map<string, InspectorFinding>();
  for (const finding of findings) {
    const key = `${finding.checkId}:${finding.filePath ?? ""}:${finding.message}`;
    if (!byKey.has(key)) {
      byKey.set(key, finding);
    }
  }
  return [...byKey.values()];
};

const dedupeInventoryItems = (items: readonly CodePurityInventoryItem[]): CodePurityInventoryItem[] => {
  const byKey = new Map<string, CodePurityInventoryItem>();
  for (const item of items) {
    const key = `${item.checkId}:${item.filePath}:${item.reason}`;
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
};

export const runCodePurityPhases = async (context: InspectorContext): Promise<CodePurityPhaseRun> => {
  const governedFiles = collectCodePurityGovernedFiles(context.project);
  const structuralScan = scanStructuralBudgets(governedFiles, context.planEntry.lawIds);
  const ownerBoundaryScan = scanOwnerBoundaries(governedFiles, context.planEntry.lawIds);
  const zombieScan = scanZombieSurfaces(context, governedFiles, context.planEntry.lawIds);
  const findings = dedupeFindings([
    ...structuralScan.findings,
    ...ownerBoundaryScan.findings,
    ...zombieScan.findings,
  ]);
  const inventoryItems = dedupeInventoryItems([
    ...structuralScan.inventoryItems,
    ...ownerBoundaryScan.inventoryItems,
    ...zombieScan.inventoryItems,
  ]);

  return {
    findings: dedupeFindings(findings),
    inspectedFiles: governedFiles.map((governedFile) => governedFile.repoPath),
    inventoryItems,
    summary: zombieScan.summary,
  };
};
