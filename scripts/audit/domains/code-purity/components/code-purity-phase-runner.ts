import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { collectCodePurityGovernedFiles } from "./code-purity-governed-files.js";
import {
  writeCodePurityInventoryReport,
  type CodePurityInventoryItem,
} from "./code-purity-report-writer.js";
import { scanCodePurityNoRegex } from "./scan-code-purity-no-regex.js";
import { scanOwnerBoundaries } from "./scan-owner-boundaries.js";
import { scanStructuralBudgets } from "./scan-structural-budgets.js";
import { scanZombieSurfaces, type ZombieScanSummary } from "./scan-zombie-surfaces.js";

type CodePurityPhaseRun = {
  findings: InspectorFinding[];
  inspectedFiles: string[];
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
  const noRegexFindings = scanCodePurityNoRegex(context.project, context.planEntry.lawIds);
  const findings = dedupeFindings([
    ...structuralScan.findings,
    ...ownerBoundaryScan.findings,
    ...noRegexFindings,
    ...zombieScan.findings,
  ]);
  const inventoryItems = dedupeInventoryItems([
    ...structuralScan.inventoryItems,
    ...ownerBoundaryScan.inventoryItems,
    ...zombieScan.inventoryItems,
  ]);

  try {
    writeCodePurityInventoryReport(inventoryItems);
  } catch (error) {
    findings.push(
      createFinding({
        checkId: "code-purity/inventory-report-write",
        lawId: selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-015-V1"),
        message: "Code-purity inventory report could not be written.",
        evidence: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  return {
    findings: dedupeFindings(findings),
    inspectedFiles: governedFiles.map((governedFile) => governedFile.repoPath),
    summary: zombieScan.summary,
  };
};