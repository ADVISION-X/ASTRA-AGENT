import type { InspectorContext, InspectorFinding, StaticCheckReceipt } from "../../../shared/inspector-contracts.js";
import { collectCodePurityGovernedFiles } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-inventory.js";
import { scanOwnerBoundaries } from "./scan-owner-boundaries.js";
import {
  scanStructuralAstBudgets,
  scanStructuralDependencyBudgets,
  scanStructuralFilesystemBudgets,
  scanStructuralTypeBudgets,
} from "./scan-structural-budgets.js";
import {
  scanConfiguredEntrypointLiveness,
  scanJsonRegistryLiveness,
  scanOwnerAstRoles,
  scanOwnerConfiguration,
  scanOwnerFilesystemAuthority,
  scanOwnerJsonAuthority,
  scanOwnerYamlAuthority,
} from "./scan-mode-native-surfaces.js";
import { scanZombieSurfaces, type ZombieScanSummary } from "./scan-zombie-surfaces.js";

type CodePurityPhaseRun = {
  findings: InspectorFinding[];
  inspectedFiles: string[];
  inventoryItems: CodePurityInventoryItem[];
  summary: ZombieScanSummary;
  staticCheckReceipts: StaticCheckReceipt[];
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
  const structuralAst = scanStructuralAstBudgets(governedFiles, context.planEntry.lawIds);
  const structuralFilesystem = scanStructuralFilesystemBudgets(governedFiles, context.planEntry.lawIds);
  const structuralTypes = scanStructuralTypeBudgets(governedFiles, context.planEntry.lawIds);
  const structuralDependencies = scanStructuralDependencyBudgets(governedFiles, context.planEntry.lawIds);
  const ownerBoundaryScan = scanOwnerBoundaries(governedFiles, context.planEntry.lawIds);
  const zombieScan = scanZombieSurfaces(context, governedFiles, context.planEntry.lawIds);
  const zombieFilesystem = zombieScan.findings.filter((finding) => finding.checkId === "code-purity/zombie-file");
  const zombieAst = zombieScan.findings.filter((finding) => [
    "code-purity/commented-out-executable-code", "code-purity/zombie-dead-branch",
    "code-purity/dead-export-helper-subgraph", "code-purity/dead-internal-declaration-subgraph",
    "code-purity/runtime-rooted-liveness-unproven",
  ].includes(finding.checkId));
  const zombieDependencies = zombieScan.findings.filter((finding) =>
    !zombieFilesystem.includes(finding) && !zombieAst.includes(finding));
  const ownerAst = scanOwnerAstRoles(governedFiles, context.planEntry.lawIds);
  const ownerFilesystem = scanOwnerFilesystemAuthority(governedFiles, context.planEntry.lawIds);
  const ownerConfig = scanOwnerConfiguration(context, context.planEntry.lawIds);
  const ownerJson = scanOwnerJsonAuthority(context, context.planEntry.lawIds);
  const ownerYaml = scanOwnerYamlAuthority(context, context.planEntry.lawIds);
  const liveConfig = scanConfiguredEntrypointLiveness(context, context.planEntry.lawIds);
  const liveJson = scanJsonRegistryLiveness(context, context.planEntry.lawIds);
  const findings = dedupeFindings([
    ...structuralAst.findings,
    ...structuralFilesystem.findings,
    ...structuralTypes.findings,
    ...structuralDependencies.findings,
    ...ownerBoundaryScan.findings,
    ...zombieScan.findings,
    ...ownerAst,
    ...ownerFilesystem,
    ...ownerConfig,
    ...ownerJson,
    ...ownerYaml,
    ...liveConfig,
    ...liveJson,
  ]);
  const inventoryItems = dedupeInventoryItems([
    ...structuralAst.inventoryItems,
    ...structuralFilesystem.inventoryItems,
    ...structuralTypes.inventoryItems,
    ...structuralDependencies.inventoryItems,
    ...ownerBoundaryScan.inventoryItems,
    ...zombieScan.inventoryItems,
  ]);

  const checks = [
    ["scanStructuralAstBudgets", structuralAst.findings],
    ["scanStructuralFilesystemBudgets", structuralFilesystem.findings],
    ["scanStructuralTypeBudgets", structuralTypes.findings],
    ["scanStructuralDependencyBudgets", structuralDependencies.findings],
    ["scanOwnerBoundaries", ownerBoundaryScan.findings],
    ["scanOwnerAstRoles", ownerAst],
    ["scanOwnerFilesystemAuthority", ownerFilesystem],
    ["scanOwnerConfiguration", ownerConfig],
    ["scanOwnerJsonAuthority", ownerJson],
    ["scanOwnerYamlAuthority", ownerYaml],
    ["scanZombieAst", zombieAst],
    ["scanZombieFilesystem", zombieFilesystem],
    ["scanZombieDependencies", zombieDependencies],
    ["scanConfiguredEntrypointLiveness", liveConfig],
    ["scanJsonRegistryLiveness", liveJson],
  ] as const;

  return {
    findings: dedupeFindings(findings),
    inspectedFiles: governedFiles.map((governedFile) => governedFile.repoPath),
    inventoryItems,
    summary: zombieScan.summary,
    staticCheckReceipts: context.planEntry.lawIds.flatMap((lawId) => checks.map(([check, checkFindings]) => ({
      check, lawId, passed: checkFindings.every((finding) => finding.lawId !== lawId),
    }))),
  };
};
