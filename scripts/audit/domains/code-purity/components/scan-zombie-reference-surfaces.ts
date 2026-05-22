import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import { isLawfulZombieEntrypoint, pushZombieFinding, type ZombieGraph } from "./zombie-surface-shared.js";

const scanZombieFiles = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  graph: ZombieGraph,
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    const inboundFiles = graph.inboundByFile.get(governedFile.repoPath);
    if ((inboundFiles?.size ?? 0) > 0 || isLawfulZombieEntrypoint(governedFile, graph)) {
      continue;
    }
    pushZombieFinding(collector, {
      checkId: "code-purity/zombie-file",
      governedFile,
      lawId: zombieLawId,
      reason: "Active file has no lawful inbound reference and is not a declared entry surface.",
      remediation: "Delete the file or reconnect it through a lawful package entry, generated-plan owner load, or active importer.",
      message: `${governedFile.repoPath} has no lawful inbound reference and behaves like a zombie file.`,
    });
  }
};

const scanZombieExports = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  graph: ZombieGraph,
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    if (isLawfulZombieEntrypoint(governedFile, graph) || graph.namespaceImportedFiles.has(governedFile.repoPath)) {
      continue;
    }
    const importedNames = graph.importedNamesByFile.get(governedFile.repoPath) ?? new Set<string>();
    for (const [exportName] of governedFile.sourceFile.getExportedDeclarations()) {
      if (importedNames.has(exportName)) {
        continue;
      }
      pushZombieFinding(collector, {
        checkId: "code-purity/zombie-export",
        governedFile,
        lawId: zombieLawId,
        reason: `Export ${exportName} has no active importer or namespace consumer.`,
        remediation: "Delete the export, delete the file, or reconnect the consumer through a lawful import surface.",
        message: `${governedFile.repoPath} exports ${exportName} without any active consumer.`,
      });
    }
  }
};

export const scanZombieReferenceSurfaces = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  graph: ZombieGraph,
  zombieLawId: string,
): void => {
  scanZombieFiles(collector, governedFiles, graph, zombieLawId);
  scanZombieExports(collector, governedFiles, graph, zombieLawId);
};