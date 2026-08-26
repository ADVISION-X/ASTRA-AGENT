import {
  collectResolvedModuleBindings,
  type SourceModuleBinding,
} from "../../../shared/source-module-targets.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export type ZombieModuleGraph = {
  dynamicImportEdges: SourceModuleBinding[];
  filesByPath: Map<string, GovernedFile>;
  importEdges: SourceModuleBinding[];
  inboundEdgesByFile: Map<string, SourceModuleBinding[]>;
  outboundEdgesByFile: Map<string, SourceModuleBinding[]>;
  reExportEdges: SourceModuleBinding[];
  sideEffectImportEdges: SourceModuleBinding[];
};

export type ZombieReachability = {
  reachableFiles: Set<string>;
};

const appendEdge = (
  edge: SourceModuleBinding,
  graph: ZombieModuleGraph,
): void => {
  graph.outboundEdgesByFile.get(edge.sourcePath)?.push(edge);
  graph.inboundEdgesByFile.get(edge.targetPath)?.push(edge);
  if (edge.edgeKind === "import") {
    graph.importEdges.push(edge);
  } else if (edge.edgeKind === "re-export") {
    graph.reExportEdges.push(edge);
  } else if (edge.edgeKind === "dynamic-import") {
    graph.dynamicImportEdges.push(edge);
  } else {
    graph.sideEffectImportEdges.push(edge);
  }
};

export const buildZombieModuleGraph = (governedFiles: readonly GovernedFile[]): ZombieModuleGraph => {
  const filesByPath = new Map(governedFiles.map((governedFile) => [governedFile.repoPath, governedFile]));
  const graph: ZombieModuleGraph = {
    dynamicImportEdges: [],
    filesByPath,
    importEdges: [],
    inboundEdgesByFile: new Map(governedFiles.map((governedFile) => [governedFile.repoPath, []])),
    outboundEdgesByFile: new Map(governedFiles.map((governedFile) => [governedFile.repoPath, []])),
    reExportEdges: [],
    sideEffectImportEdges: [],
  };

  for (const governedFile of governedFiles) {
    for (const binding of collectResolvedModuleBindings(governedFile.sourceFile)) {
      if (!filesByPath.has(binding.targetPath)) {
        continue;
      }
      appendEdge(binding, graph);
    }
  }

  return graph;
};

export const collectZombieReachableFiles = (input: {
  entryFiles: ReadonlySet<string>;
  moduleGraph: ZombieModuleGraph;
}): ZombieReachability => {
  const reachableFiles = new Set<string>();
  const pendingFiles = [...input.entryFiles];

  while (pendingFiles.length > 0) {
    const currentFile = pendingFiles.shift();
    if (!currentFile || reachableFiles.has(currentFile)) {
      continue;
    }
    reachableFiles.add(currentFile);
    for (const edge of input.moduleGraph.outboundEdgesByFile.get(currentFile) ?? []) {
      // Resolved literal dynamic and side-effect imports are native module-graph
      // facts. Non-literal or unresolved edges never enter this graph and are
      // rejected by the anti-evasion scanners.
      if (!reachableFiles.has(edge.targetPath)) {
        pendingFiles.push(edge.targetPath);
      }
    }
  }

  return {
    reachableFiles,
  };
};
