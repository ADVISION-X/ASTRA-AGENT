import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  isLawfulZombieExport,
  pushZombieFinding,
  type ZombieGraph,
} from "./zombie-surface-shared.js";

const scanZombieFiles = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  graph: ZombieGraph,
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    if (graph.reachableFiles.has(governedFile.repoPath)) {
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
  }
};

const scanZombieExports = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  graph: ZombieGraph,
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    if (!graph.reachableFiles.has(governedFile.repoPath) || graph.namespaceImportedFiles.has(governedFile.repoPath)) {
      continue;
    }
    const importedNames = graph.importedNamesByFile.get(governedFile.repoPath) ?? new Set<string>();
    for (const [exportName] of governedFile.sourceFile.getExportedDeclarations()) {
      if (isLawfulZombieExport(governedFile, exportName)) {
        continue;
      }
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