import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { selectLawId } from "../../../shared/finding-utils.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-report-writer.js";
import { scanZombieDeadBranches } from "./scan-zombie-dead-branches.js";
import { scanZombieDeclarations } from "./scan-zombie-declarations.js";
import { scanZombieReferenceSurfaces } from "./scan-zombie-reference-surfaces.js";
import { scanZombieAntiEvasion, scanZombieInspectorSelfProof } from "./zombie-anti-evasion.js";
import { collectZombieCommentedCodeHits } from "./zombie-commented-code.js";
import { zombieExemptionManifest, type ZombieExemptionManifest } from "./zombie-exemption-manifest.js";
import { collectZombieLiveEntrypoints, type ZombieLiveEntryPoint } from "./zombie-live-entrypoints.js";
import { buildZombieModuleGraph, collectZombieReachableFiles } from "./zombie-module-graph.js";
import { scanZombieNamespaceUsage } from "./zombie-namespace-usage.js";
import { collectZombieBarrelLaunderingSurfaces } from "./zombie-reexport-trace.js";
import { buildZombieSymbolGraph } from "./zombie-symbol-graph.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

export type ZombieScanSummary = {
  antiEvasionFindingCount: number;
  commentedOutCodeCount: number;
  deadBranchCount: number;
  liveEntryPoints: ZombieLiveEntryPoint[];
  liveExportCount: number;
  orphanDeclarationCount: number;
  reachableFileCount: number;
  unreachableFileCount: number;
  zombieExportCount: number;
};

type ZombieScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
  summary: ZombieScanSummary;
};

type ZombieScanOverrides = {
  manifest?: ZombieExemptionManifest;
  packageScripts?: Readonly<Record<string, string>>;
};

export const scanZombieSurfaces = (
  context: InspectorContext,
  governedFiles: readonly GovernedFile[],
  lawIds: readonly string[],
  overrides: ZombieScanOverrides = {},
): ZombieScanResult => {
  const collector = createInventoryFindingCollector();
  const zombieLawId = selectLawId(lawIds, "APEX-CODE-PURITY-017-V1");
  const antiEvasionLawId = selectLawId(lawIds, "APEX-CODE-PURITY-018-V1");
  const manifest = overrides.manifest ?? zombieExemptionManifest;
  const liveEntryState = collectZombieLiveEntrypoints({
    generatedPlan: context.generatedPlan,
    governedFiles,
    manifest,
    packageScripts: overrides.packageScripts,
  });
  const moduleGraph = buildZombieModuleGraph(governedFiles);
  const reachability = collectZombieReachableFiles({
    entryFiles: liveEntryState.entryFiles,
    manifest,
    moduleGraph,
  });
  const symbolGraph = buildZombieSymbolGraph(governedFiles);
  const namespaceUsage = scanZombieNamespaceUsage({
    manifest,
    moduleGraph,
    reachableFiles: reachability.reachableFiles,
  });

  const referenceSummary = scanZombieReferenceSurfaces(collector, {
    antiEvasionLawId,
    manifest,
    moduleGraph,
    namespaceUsage,
    reachability,
    symbolGraph,
  }, zombieLawId);
  const declarationSummary = scanZombieDeclarations(
    collector,
    governedFiles,
    zombieLawId,
    antiEvasionLawId,
    reachability,
  );
  const deadBranchSummary = scanZombieDeadBranches(collector, governedFiles, zombieLawId, reachability);

  let commentedOutCodeCount = 0;
  for (const governedFile of governedFiles) {
    if (!reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    for (const hit of collectZombieCommentedCodeHits(governedFile.sourceFile)) {
      pushZombieFinding(collector, {
        checkId: "code-purity/commented-out-executable-code",
        governedFile,
        lawId: antiEvasionLawId,
        reason: `Comment at line ${hit.line} parses as executable or declarative code and acts like commented-out implementation cargo.`,
        remediation: "Delete the commented-out executable code instead of keeping it as backup cargo.",
        message: `${governedFile.repoPath} contains commented-out executable code near line ${hit.line}.`,
      });
      commentedOutCodeCount += 1;
    }
  }

  let antiEvasionFindingCount = scanZombieAntiEvasion({
    antiEvasionLawId,
    barrelLaunderingSurfaces: collectZombieBarrelLaunderingSurfaces({
      reachableFiles: reachability.reachableFiles,
      symbolGraph,
    }),
    collector,
    governedFiles,
    moduleGraph,
    namespaceUsage,
    reachability,
  });
  antiEvasionFindingCount += scanZombieInspectorSelfProof({
    antiEvasionLawId,
    collector,
    context,
    inspectedFileCount: governedFiles.length,
  });

  return {
    findings: collector.findings,
    inventoryItems: collector.inventoryItems,
    summary: {
      antiEvasionFindingCount,
      commentedOutCodeCount,
      deadBranchCount: deadBranchSummary.deadBranchCount,
      liveEntryPoints: liveEntryState.liveEntryPoints,
      liveExportCount: referenceSummary.liveExportCount,
      orphanDeclarationCount: declarationSummary.orphanDeclarationCount,
      reachableFileCount: reachability.reachableFiles.size,
      unreachableFileCount: referenceSummary.unreachableFileCount,
      zombieExportCount: referenceSummary.zombieExportCount,
    },
  };
};
