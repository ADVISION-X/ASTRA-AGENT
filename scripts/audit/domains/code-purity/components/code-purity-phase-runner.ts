import type { InspectorContext, InspectorFinding, StaticCheckReceipt } from "../../../shared/inspector-contracts.js";
import { staticImplementationDigest } from "../../../shared/static-inspection-contract.js";
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
type ZombieScan = ReturnType<typeof scanZombieSurfaces>;
type StaticCheck = readonly [string, readonly InspectorFinding[], (...args: never[]) => unknown];

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

const scanZombieFilesystem = (scan: ZombieScan): InspectorFinding[] =>
  scan.findings.filter((finding) => finding.checkId === "code-purity/zombie-file");
const scanZombieAst = (scan: ZombieScan): InspectorFinding[] => scan.findings.filter((finding) => [
  "code-purity/commented-out-executable-code", "code-purity/zombie-dead-branch",
  "code-purity/dead-export-helper-subgraph", "code-purity/dead-internal-declaration-subgraph",
  "code-purity/runtime-rooted-liveness-unproven",
].includes(finding.checkId));
const scanZombieDependencies = (
  scan: ZombieScan, filesystem: readonly InspectorFinding[], ast: readonly InspectorFinding[],
): InspectorFinding[] => scan.findings.filter((finding) => !filesystem.includes(finding) && !ast.includes(finding));

const buildStaticCheckReceipts = (
  lawIds: readonly string[], checks: readonly StaticCheck[],
): StaticCheckReceipt[] => lawIds.flatMap((lawId) => checks.map(([check, findings, implementation]) => ({
  check, implementationDigest: staticImplementationDigest(implementation), lawId,
  passed: findings.every((finding) => finding.lawId !== lawId),
})));

export const runCodePurityPhases = async (context: InspectorContext): Promise<CodePurityPhaseRun> => {
  const governedFiles = collectCodePurityGovernedFiles(context.project);
  const structuralAst = scanStructuralAstBudgets(governedFiles, context.planEntry.lawIds);
  const structuralFilesystem = scanStructuralFilesystemBudgets(governedFiles, context.planEntry.lawIds);
  const structuralTypes = scanStructuralTypeBudgets(governedFiles, context.planEntry.lawIds);
  const structuralDependencies = scanStructuralDependencyBudgets(governedFiles, context.planEntry.lawIds);
  const ownerBoundaryScan = scanOwnerBoundaries(governedFiles, context.planEntry.lawIds);
  const zombieScan = scanZombieSurfaces(context, governedFiles, context.planEntry.lawIds);
  const zombieFilesystem = scanZombieFilesystem(zombieScan);
  const zombieAst = scanZombieAst(zombieScan);
  const zombieDependencies = scanZombieDependencies(zombieScan, zombieFilesystem, zombieAst);
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

  const checks: readonly StaticCheck[] = [
    ["scanStructuralAstBudgets", structuralAst.findings, scanStructuralAstBudgets],
    ["scanStructuralFilesystemBudgets", structuralFilesystem.findings, scanStructuralFilesystemBudgets],
    ["scanStructuralTypeBudgets", structuralTypes.findings, scanStructuralTypeBudgets],
    ["scanStructuralDependencyBudgets", structuralDependencies.findings, scanStructuralDependencyBudgets],
    ["scanOwnerBoundaries", ownerBoundaryScan.findings, scanOwnerBoundaries],
    ["scanOwnerAstRoles", ownerAst, scanOwnerAstRoles],
    ["scanOwnerFilesystemAuthority", ownerFilesystem, scanOwnerFilesystemAuthority],
    ["scanOwnerConfiguration", ownerConfig, scanOwnerConfiguration],
    ["scanOwnerJsonAuthority", ownerJson, scanOwnerJsonAuthority],
    ["scanOwnerYamlAuthority", ownerYaml, scanOwnerYamlAuthority],
    ["scanZombieAst", zombieAst, scanZombieAst],
    ["scanZombieFilesystem", zombieFilesystem, scanZombieFilesystem],
    ["scanZombieDependencies", zombieDependencies, scanZombieDependencies],
    ["scanConfiguredEntrypointLiveness", liveConfig, scanConfiguredEntrypointLiveness],
    ["scanJsonRegistryLiveness", liveJson, scanJsonRegistryLiveness],
  ];

  return {
    findings: dedupeFindings(findings),
    inspectedFiles: governedFiles.map((governedFile) => governedFile.repoPath),
    inventoryItems,
    summary: zombieScan.summary,
    staticCheckReceipts: buildStaticCheckReceipts(context.planEntry.lawIds, checks),
  };
};
