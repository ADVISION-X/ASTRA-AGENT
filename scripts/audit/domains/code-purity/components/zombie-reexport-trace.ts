import type { ZombieSymbolGraph } from "./zombie-symbol-graph.js";
import { isMeaningfulZombieReference } from "./zombie-symbol-usage.js";

export type ZombieBarrelLaunderingSurface = {
  declaringFile: string;
  exportName: string;
  exportingFile: string;
  symbolId: string;
};

export const collectZombieBarrelLaunderingSurfaces = (input: {
  reachableFiles: ReadonlySet<string>;
  symbolGraph: ZombieSymbolGraph;
}): ZombieBarrelLaunderingSurface[] => {
  const surfaces: ZombieBarrelLaunderingSurface[] = [];
  for (const exportSymbols of input.symbolGraph.exportsByFile.values()) {
    for (const exportSymbol of exportSymbols) {
      if (exportSymbol.exportingFile === exportSymbol.declaringFile || !input.reachableFiles.has(exportSymbol.exportingFile)) {
        continue;
      }
      const reachableReferences = (input.symbolGraph.referencesBySymbol.get(exportSymbol.symbolId) ?? []).filter(
        (reference) => input.reachableFiles.has(reference.referencingFile),
      );
      const hasMeaningfulUsage = reachableReferences.some((reference) => isMeaningfulZombieReference(reference.usageKind));
      if (!hasMeaningfulUsage) {
        surfaces.push({
          declaringFile: exportSymbol.declaringFile,
          exportName: exportSymbol.exportName,
          exportingFile: exportSymbol.exportingFile,
          symbolId: exportSymbol.symbolId,
        });
      }
    }
  }
  return surfaces;
};