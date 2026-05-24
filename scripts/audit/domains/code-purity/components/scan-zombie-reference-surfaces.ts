import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import {
  isLawfulZombieExport,
  pushZombieFinding,
} from "./zombie-surface-shared.js";
import type { ZombieExemptionManifest } from "./zombie-exemption-manifest.js";
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
  zombieLawId: string,
): number => {
  let unreachableFileCount = 0;
  for (const governedFile of moduleGraph.filesByPath.values()) {
    if (reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    pushZombieFinding(collector, {
      checkId: "code-purity/zombie-file",
      governedFile,
      lawId: zombieLawId,
      reason: "Active file is unreachable from every lawful entry surface and behaves like dead chain cargo.",
      remediation: "Delete the file or reconnect it from a lawful package entry, generated-plan owner load, or reachable active importer.",
      message: `${governedFile.repoPath} is not reachable from any lawful live entry surface and behaves like a zombie file.`,
    });
    unreachableFileCount += 1;
  }
  return unreachableFileCount;
};

const scanZombieExports = (
  collector: InventoryFindingCollector,
  input: {
    manifest: ZombieExemptionManifest;
    moduleGraph: ZombieModuleGraph;
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    symbolGraph: ZombieSymbolGraph;
  },
  antiEvasionLawId: string,
  zombieLawId: string,
): { liveExportCount: number; zombieExportCount: number } => {
  let liveExportCount = 0;
  let zombieExportCount = 0;

  for (const resolutionFailure of input.symbolGraph.resolutionFailures) {
    const governedFile = input.moduleGraph.filesByPath.get(resolutionFailure.exportingFile);
    if (!governedFile || !input.reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    pushZombieFinding(collector, {
      checkId: "code-purity/symbol-resolution-unavailable",
      declarationKind: resolutionFailure.localDeclarationName ? "export" : undefined,
      governedFile,
      lawId: antiEvasionLawId,
      reason: `Symbol graph could not resolve references for export ${resolutionFailure.exportName}: ${resolutionFailure.error}`,
      remediation: "Repair ts-morph symbol resolution for this export; unprovable liveness must fail instead of falling back to string counting.",
      symbolName: resolutionFailure.exportName,
      message: `${governedFile.repoPath} could not resolve symbol references for export ${resolutionFailure.exportName}.`,
    });
  }

  for (const [filePath, exportSymbols] of input.symbolGraph.exportsByFile) {
    const governedFile = input.moduleGraph.filesByPath.get(filePath);
    if (!governedFile || !input.reachability.reachableFiles.has(filePath)) {
      continue;
    }
    for (const exportSymbol of exportSymbols) {
      if (isLawfulZombieExport(governedFile, exportSymbol.exportName, input.manifest)) {
        continue;
      }
      const reachableReferences = (input.symbolGraph.referencesBySymbol.get(exportSymbol.symbolId) ?? []).filter(
        (reference) => input.reachability.reachableFiles.has(reference.referencingFile),
      );
      const meaningfulReferences = reachableReferences.filter((reference) => isMeaningfulZombieReference(reference.usageKind));
      const namespacePropertyUsageCount = countNamespacePropertyUsage(exportSymbol, input.namespaceUsage);
      const hasTypeUsage = meaningfulReferences.some((reference) => isZombieTypeUsage(reference.usageKind));
      const hasRuntimeUsage = meaningfulReferences.some((reference) => isZombieRuntimeUsage(reference.usageKind))
        || namespacePropertyUsageCount > 0;
      const isLive = exportSymbol.isTypeOnly
        ? hasTypeUsage
        : exportSymbol.isRuntimeValue
          ? hasRuntimeUsage
          : meaningfulReferences.length > 0;
      if (isLive) {
        liveExportCount += 1;
        continue;
      }

      let usageKind: string | undefined;
      let reason = `Export ${exportSymbol.exportName} has no final reachable consumer.`;
      if (hasTypeUsage && !hasRuntimeUsage && exportSymbol.isRuntimeValue) {
        usageKind = "type";
        reason = `Export ${exportSymbol.exportName} is only used in type positions; type-only usage does not prove runtime liveness.`;
      } else if (reachableReferences.some((reference) => reference.usageKind === "re-export")) {
        usageKind = "re-export";
        reason = `Export ${exportSymbol.exportName} only survives through a re-export chain and has no final reachable consumer.`;
      } else if (reachableReferences.some((reference) => reference.usageKind === "import-binding")) {
        usageKind = "import-binding";
        reason = `Export ${exportSymbol.exportName} is imported but never used by a reachable consumer.`;
      }

      pushZombieFinding(collector, {
        checkId: "code-purity/zombie-export",
        declarationKind: exportSymbol.declarationKind,
        governedFile,
        lawId: zombieLawId,
        reason,
        remediation: "Delete the export, delete the file, or reconnect the consumer through a lawful import surface.",
        symbolName: exportSymbol.exportName,
        usageKind,
        message: `${governedFile.repoPath} exports ${exportSymbol.exportName} without any provable final consumer.`,
      });
      zombieExportCount += 1;
    }
  }
  return { liveExportCount, zombieExportCount };
};

export const scanZombieReferenceSurfaces = (
  collector: InventoryFindingCollector,
  input: {
    antiEvasionLawId: string;
    manifest: ZombieExemptionManifest;
    moduleGraph: ZombieModuleGraph;
    namespaceUsage: ZombieNamespaceUsageReport;
    reachability: ZombieReachability;
    symbolGraph: ZombieSymbolGraph;
  },
  zombieLawId: string,
): ZombieReferenceSurfaceSummary => {
  const unreachableFileCount = scanZombieFiles(collector, input.moduleGraph, input.reachability, zombieLawId);
  const exportSummary = scanZombieExports(collector, input, input.antiEvasionLawId, zombieLawId);
  return {
    liveExportCount: exportSummary.liveExportCount,
    unreachableFileCount,
    zombieExportCount: exportSummary.zombieExportCount,
  };
};