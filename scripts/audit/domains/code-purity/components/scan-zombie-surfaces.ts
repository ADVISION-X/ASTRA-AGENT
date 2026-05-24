import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { selectLawId } from "../../../shared/finding-utils.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-report-writer.js";
import { scanZombieDeadBranches } from "./scan-zombie-dead-branches.js";
import { scanZombieInternalSubgraphs } from "./scan-zombie-internal-subgraphs.js";
import { scanZombieObjectBags } from "./scan-zombie-object-bags.js";
import { scanZombieReferenceSurfaces } from "./scan-zombie-reference-surfaces.js";
import { scanZombieAntiEvasion, scanZombieInspectorSelfProof } from "./zombie-anti-evasion.js";
import { collectZombieCommentedCodeHits } from "./zombie-commented-code.js";
import { buildZombieDeclarationLiveGraph } from "./zombie-declaration-live-graph.js";
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

type ZombieGraphState = {
  antiEvasionLawId: string;
  dynamicImportLawId: string;
  liveEntryState: ReturnType<typeof collectZombieLiveEntrypoints>;
  manifest: ZombieExemptionManifest;
  moduleGraph: ReturnType<typeof buildZombieModuleGraph>;
  namespaceUsage: ReturnType<typeof scanZombieNamespaceUsage>;
  reachability: ReturnType<typeof collectZombieReachableFiles>;
  sideEffectImportLawId: string;
  symbolGraph: ReturnType<typeof buildZombieSymbolGraph>;
  zombieLawId: string;
};

const buildZombieGraphState = (
  context: InspectorContext,
  governedFiles: readonly GovernedFile[],
  overrides: ZombieScanOverrides,
  lawIds: readonly string[],
): ZombieGraphState => {
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
  return {
    antiEvasionLawId: selectLawId(lawIds, "APEX-CODE-PURITY-018-V1"),
    dynamicImportLawId: selectLawId(lawIds, "APEX-CODE-PURITY-020-V1"),
    liveEntryState,
    manifest,
    moduleGraph,
    namespaceUsage: scanZombieNamespaceUsage({
      manifest,
      moduleGraph,
      reachableFiles: reachability.reachableFiles,
    }),
    reachability,
    sideEffectImportLawId: selectLawId(lawIds, "APEX-CODE-PURITY-019-V1"),
    symbolGraph: buildZombieSymbolGraph(governedFiles),
    zombieLawId: selectLawId(lawIds, "APEX-CODE-PURITY-017-V1"),
  };
};

const scanReachableCommentedCode = (
  collector: ReturnType<typeof createInventoryFindingCollector>,
  antiEvasionLawId: string,
  governedFiles: readonly GovernedFile[],
  reachableFiles: ReadonlySet<string>,
): number => {
  let commentedOutCodeCount = 0;
  for (const governedFile of governedFiles) {
    if (!reachableFiles.has(governedFile.repoPath)) {
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
  return commentedOutCodeCount;
};

const scanAntiEvasionFindings = (
  collector: ReturnType<typeof createInventoryFindingCollector>,
  context: InspectorContext,
  governedFiles: readonly GovernedFile[],
  state: ZombieGraphState,
): number => {
  let antiEvasionFindingCount = scanZombieAntiEvasion({
    antiEvasionLawId: state.antiEvasionLawId,
    dynamicImportLawId: state.dynamicImportLawId,
    barrelLaunderingSurfaces: collectZombieBarrelLaunderingSurfaces({
      reachableFiles: state.reachability.reachableFiles,
      symbolGraph: state.symbolGraph,
    }),
    collector,
    governedFiles,
    moduleGraph: state.moduleGraph,
    namespaceUsage: state.namespaceUsage,
    reachability: state.reachability,
    sideEffectImportLawId: state.sideEffectImportLawId,
  });
  antiEvasionFindingCount += scanZombieInspectorSelfProof({
    antiEvasionLawId: state.antiEvasionLawId,
    collector,
    context,
    inspectedFileCount: governedFiles.length,
  });
  return antiEvasionFindingCount;
};

export const scanZombieSurfaces = (
  context: InspectorContext,
  governedFiles: readonly GovernedFile[],
  lawIds: readonly string[],
  overrides: ZombieScanOverrides = {},
): ZombieScanResult => {
  const collector = createInventoryFindingCollector();
  const state = buildZombieGraphState(context, governedFiles, overrides, lawIds);

  const referenceSummary = scanZombieReferenceSurfaces(collector, {
    antiEvasionLawId: state.antiEvasionLawId,
    manifest: state.manifest,
    moduleGraph: state.moduleGraph,
    namespaceUsage: state.namespaceUsage,
    reachability: state.reachability,
    symbolGraph: state.symbolGraph,
  }, state.zombieLawId);
  const declarationGraph = buildZombieDeclarationLiveGraph({
    governedFiles,
    liveExportSymbolIds: referenceSummary.liveExportSymbolIds,
    manifest: state.manifest,
    reachability: state.reachability,
    symbolGraph: state.symbolGraph,
  });
  scanZombieObjectBags({
    antiEvasionLawId: state.antiEvasionLawId,
    collector,
    liveExportSymbolIds: referenceSummary.liveExportSymbolIds,
    manifest: state.manifest,
    moduleGraph: state.moduleGraph,
    symbolGraph: state.symbolGraph,
    zombieLawId: state.zombieLawId,
  });
  const declarationSummary = scanZombieInternalSubgraphs(
    collector,
    declarationGraph,
    state.zombieLawId,
    state.antiEvasionLawId,
  );
  const deadBranchSummary = scanZombieDeadBranches(collector, governedFiles, state.zombieLawId, state.reachability);
  const commentedOutCodeCount = scanReachableCommentedCode(
    collector,
    state.antiEvasionLawId,
    governedFiles,
    state.reachability.reachableFiles,
  );
  const antiEvasionFindingCount = scanAntiEvasionFindings(collector, context, governedFiles, state);

  return {
    findings: collector.findings,
    inventoryItems: collector.inventoryItems,
    summary: {
      antiEvasionFindingCount,
      commentedOutCodeCount,
      deadBranchCount: deadBranchSummary.deadBranchCount,
      liveEntryPoints: state.liveEntryState.liveEntryPoints,
      liveExportCount: referenceSummary.liveExportCount,
      orphanDeclarationCount: declarationSummary.orphanDeclarationCount,
      reachableFileCount: state.reachability.reachableFiles.size,
      unreachableFileCount: referenceSummary.unreachableFileCount,
      zombieExportCount: referenceSummary.zombieExportCount,
    },
  };
};
