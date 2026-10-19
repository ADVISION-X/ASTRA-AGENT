import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";
import type { ZombieModuleGraph, ZombieReachability } from "./zombie-module-graph.js";
import type { ZombieNamespaceUsageReport } from "./zombie-namespace-usage.js";
import type { ZombieExportSymbol, ZombieSymbolGraph } from "./zombie-symbol-graph.js";
import {
  isMeaningfulZombieReference,
  isZombieRuntimeUsage,
  isZombieTypeUsage,
} from "./zombie-symbol-usage.js";

export type ZombieReferenceSurfaceSummary = {
  liveExportCount: number;
  liveExportSymbolIds: Set<string>;
  unreachableFileCount: number;
  zombieExportCount: number;
};

const countNamespacePropertyUsage = (
  exportSymbol: ZombieExportSymbol,
  namespaceUsage: ZombieNamespaceUsageReport,
): number =>
  namespaceUsage.propertyUsages.filter(
    (usage) => usage.targetFilePath === exportSymbol.exportingFile && usage.propertyName === exportSymbol.exportName,
  ).length;

const scanZombieFiles = (
  collector: InventoryFindingCollector,
  moduleGraph: ZombieModuleGraph,
  reachability: ZombieReachability,
  productionReachability: ZombieReachability,
  zombieLawId: string,
): number => {
  let unreachableFileCount = 0;
  for (const governedFile of moduleGraph.filesByPath.values()) {
    if (reachability.reachableFiles.has(governedFile.repoPath)
      && (!requiresProductionConsumer(governedFile.repoPath)
        || productionReachability.reachableFiles.has(governedFile.repoPath))) {
      continue;
    }
    const verificationOnly = reachability.reachableFiles.has(governedFile.repoPath);
    pushZombieFinding(collector, {
      checkId: "code-purity/zombie-file",
      governedFile,
      lawId: zombieLawId,
      reason: verificationOnly
        ? "Production implementation is reachable only from acceptance or governance verification roots, which cannot prove a production consumer."
        : "Active file is unreachable from every lawful entry surface and behaves like dead chain cargo.",
      remediation: verificationOnly
        ? "Delete the production implementation or connect it to a real production entrypoint."
        : "Delete the file or reconnect it from a lawful package entry, generated-plan owner load, or reachable active importer.",
      message: verificationOnly
        ? `${governedFile.repoPath} is kept alive only by verification code and has no production consumer.`
        : `${governedFile.repoPath} is not reachable from any lawful live entry surface and behaves like a zombie file.`,
    });
    unreachableFileCount += 1;
  }
  return unreachableFileCount;
};

const pushSymbolResolutionFailures = (
  collector: InventoryFindingCollector,
  input: {
    antiEvasionLawId: string;
    moduleGraph: ZombieModuleGraph;
    reachability: ZombieReachability;
    symbolGraph: ZombieSymbolGraph;
  },
): void => {
  for (const resolutionFailure of input.symbolGraph.resolutionFailures) {
    const governedFile = input.moduleGraph.filesByPath.get(resolutionFailure.exportingFile);
    if (!governedFile || !input.reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    pushZombieFinding(collector, {
      checkId: "code-purity/symbol-resolution-unavailable",
      declarationKind: resolutionFailure.localDeclarationName ? "export" : undefined,
      governedFile,
      lawId: input.antiEvasionLawId,
      reason: `Symbol graph could not resolve references for export ${resolutionFailure.exportName}: ${resolutionFailure.error}`,
      remediation: "Repair ts-morph symbol resolution for this export; unprovable liveness must fail instead of falling back to string counting.",
      symbolName: resolutionFailure.exportName,
      message: `${governedFile.repoPath} could not resolve symbol references for export ${resolutionFailure.exportName}.`,
    });
  }
};

const collectExportReferenceState = (
  exportSymbol: ZombieExportSymbol,
  input: {
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    symbolGraph: ZombieSymbolGraph;
  },
) => {
  const reachableReferences = (input.symbolGraph.referencesBySymbol.get(exportSymbol.symbolId) ?? []).filter(
    (reference) => input.reachability.reachableFiles.has(reference.referencingFile),
  );
  const meaningfulReferences = reachableReferences.filter((reference) => isMeaningfulZombieReference(reference.usageKind));
  const namespacePropertyUsageCount = countNamespacePropertyUsage(exportSymbol, input.namespaceUsage);
  return {
    hasRuntimeUsage: meaningfulReferences.some((reference) => isZombieRuntimeUsage(reference.usageKind))
      || namespacePropertyUsageCount > 0,
    hasTypeUsage: meaningfulReferences.some((reference) => isZombieTypeUsage(reference.usageKind)),
    meaningfulReferences,
    reachableReferences,
  };
};

export const requiresProductionConsumer = (filePath: string): boolean =>
  (filePath.startsWith("src/") && !filePath.includes("/acceptance/"))
  || filePath.startsWith("scripts/startup/")
  || filePath.startsWith("scripts/maintenance/");

const buildZombieExportFailure = (
  exportSymbol: ZombieExportSymbol,
  reachableReferences: ReturnType<typeof collectExportReferenceState>["reachableReferences"],
  hasRuntimeUsage: boolean,
  hasTypeUsage: boolean,
): { reason: string; usageKind?: string } => {
  if (hasTypeUsage && !hasRuntimeUsage && exportSymbol.isRuntimeValue) {
    return {
      reason: `Export ${exportSymbol.exportName} is only used in type positions; type-only usage does not prove runtime liveness.`,
      usageKind: "type",
    };
  }
  if (reachableReferences.some((reference) => reference.usageKind === "re-export")) {
    return {
      reason: `Export ${exportSymbol.exportName} only survives through a re-export chain and has no final reachable consumer.`,
      usageKind: "re-export",
    };
  }
  if (reachableReferences.some((reference) => reference.usageKind === "import-binding")) {
    return {
      reason: `Export ${exportSymbol.exportName} is imported but never used by a reachable consumer.`,
      usageKind: "import-binding",
    };
  }
  return {
    reason: `Export ${exportSymbol.exportName} has no final reachable consumer.`,
  };
};

const scanZombieExportSymbol = (
  collector: InventoryFindingCollector,
  input: {
    governedFile: ZombieModuleGraph["filesByPath"] extends Map<string, infer T> ? T : never;
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    productionReachability: ZombieReachability;
    productionNamespaceUsage: ZombieNamespaceUsageReport;
    symbolGraph: ZombieSymbolGraph;
    zombieLawId: string;
    generatedOwnerInspectorPaths: ReadonlySet<string>;
  },
  exportSymbol: ZombieExportSymbol,
): "live" | "skip" | "zombie" => {
  if (exportSymbol.exportName === "inspectDomain"
    && input.generatedOwnerInspectorPaths.has(exportSymbol.exportingFile)) {
    return "live";
  }
  const productionOnly = requiresProductionConsumer(exportSymbol.exportingFile);
  const referenceState = collectExportReferenceState(exportSymbol, {
    namespaceUsage: productionOnly ? input.productionNamespaceUsage : input.namespaceUsage,
    reachability: productionOnly ? input.productionReachability : input.reachability,
    symbolGraph: input.symbolGraph,
  });
  const isLive = exportSymbol.isTypeOnly
    ? referenceState.hasTypeUsage
    : exportSymbol.isRuntimeValue
      ? referenceState.hasRuntimeUsage
      : referenceState.meaningfulReferences.length > 0;
  if (isLive) {
    return "live";
  }
  const failure = buildZombieExportFailure(
    exportSymbol,
    referenceState.reachableReferences,
    referenceState.hasRuntimeUsage,
    referenceState.hasTypeUsage,
  );
  pushZombieFinding(collector, {
    checkId: "code-purity/zombie-export",
    declarationKind: exportSymbol.declarationKind,
    governedFile: input.governedFile,
    lawId: input.zombieLawId,
    reason: failure.reason,
    remediation: "Delete the export, delete the file, or reconnect the consumer through a lawful import surface.",
    symbolName: exportSymbol.exportName,
    usageKind: failure.usageKind,
    message: `${input.governedFile.repoPath} exports ${exportSymbol.exportName} without any provable final consumer.`,
  });
  return "zombie";
};

const scanZombieExports = (
  collector: InventoryFindingCollector,
  input: {
    moduleGraph: ZombieModuleGraph;
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    productionReachability: ZombieReachability;
    productionNamespaceUsage: ZombieNamespaceUsageReport;
    symbolGraph: ZombieSymbolGraph;
    generatedOwnerInspectorPaths: ReadonlySet<string>;
  },
  antiEvasionLawId: string,
  zombieLawId: string,
): { liveExportCount: number; liveExportSymbolIds: Set<string>; zombieExportCount: number } => {
  let liveExportCount = 0;
  const liveExportSymbolIds = new Set<string>();
  let zombieExportCount = 0;

  pushSymbolResolutionFailures(collector, {
    antiEvasionLawId,
    moduleGraph: input.moduleGraph,
    reachability: input.reachability,
    symbolGraph: input.symbolGraph,
  });

  for (const [filePath, exportSymbols] of input.symbolGraph.exportsByFile) {
    const governedFile = input.moduleGraph.filesByPath.get(filePath);
    if (!governedFile || !input.reachability.reachableFiles.has(filePath)) {
      continue;
    }
    for (const exportSymbol of exportSymbols) {
      const status = scanZombieExportSymbol(
        collector,
        {
          governedFile,
          namespaceUsage: input.namespaceUsage,
          reachability: input.reachability,
          productionReachability: input.productionReachability,
          productionNamespaceUsage: input.productionNamespaceUsage,
          symbolGraph: input.symbolGraph,
          zombieLawId,
          generatedOwnerInspectorPaths: input.generatedOwnerInspectorPaths,
        },
        exportSymbol,
      );
      if (status === "live") {
        liveExportCount += 1;
        liveExportSymbolIds.add(exportSymbol.symbolId);
      }
      if (status === "zombie") {
        zombieExportCount += 1;
      }
    }
  }
  return { liveExportCount, liveExportSymbolIds, zombieExportCount };
};

export const scanZombieReferenceSurfaces = (
  collector: InventoryFindingCollector,
  input: {
    antiEvasionLawId: string;
    moduleGraph: ZombieModuleGraph;
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    productionReachability: ZombieReachability;
    productionNamespaceUsage: ZombieNamespaceUsageReport;
    symbolGraph: ZombieSymbolGraph;
    generatedOwnerInspectorPaths: ReadonlySet<string>;
  },
  zombieLawId: string,
): ZombieReferenceSurfaceSummary => {
  const unreachableFileCount = scanZombieFiles(
    collector, input.moduleGraph, input.reachability, input.productionReachability, zombieLawId,
  );
  const exportSummary = scanZombieExports(collector, input, input.antiEvasionLawId, zombieLawId);
  return {
    liveExportCount: exportSummary.liveExportCount,
    liveExportSymbolIds: exportSummary.liveExportSymbolIds,
    unreachableFileCount,
    zombieExportCount: exportSummary.zombieExportCount,
  };
};
