import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { ZombieDeclarationLiveGraph } from "./zombie-declaration-live-graph.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const pushUnprovenLivenessFinding = (
  collector: InventoryFindingCollector,
  graph: ZombieDeclarationLiveGraph,
  antiEvasionLawId: string,
): number => {
  let findingCount = 0;
  for (const failure of graph.resolutionFailures) {
    const declaration = graph.declarationById.get(failure.declarationId);
    if (!declaration) {
      continue;
    }
    pushZombieFinding(collector, {
      checkId: "code-purity/runtime-rooted-liveness-unproven",
      declarationKind: declaration.declarationKind,
      governedFile: declaration.governedFile,
      lawId: antiEvasionLawId,
      reason: `Runtime-rooted liveness for ${declaration.name} could not be proven because symbol references failed to resolve: ${failure.error}`,
      remediation: "Repair symbol resolution for the declaration; unproven liveness must fail instead of being treated as live.",
      symbolName: declaration.name,
      message: `${declaration.governedFile.repoPath} could not prove runtime-rooted liveness for ${declaration.name}.`,
    });
    findingCount += 1;
  }
  return findingCount;
};

const resolveDeclarationCheckId = (
  graph: ZombieDeclarationLiveGraph,
  declarationId: string,
): "code-purity/dead-export-helper-subgraph" | "code-purity/dead-internal-declaration-subgraph" | "code-purity/zombie-top-level-declaration" => {
  const inboundDeclarationIds = [...(graph.inboundDeclarationIdsByDeclaration.get(declarationId) ?? [])]
    .filter((sourceId) => graph.deadDeclarationIds.has(sourceId));
  if (inboundDeclarationIds.length === 0) {
    return "code-purity/zombie-top-level-declaration";
  }
  if (inboundDeclarationIds.some((sourceId) => graph.declarationById.get(sourceId)?.isExported)) {
    return "code-purity/dead-export-helper-subgraph";
  }
  return "code-purity/dead-internal-declaration-subgraph";
};

export const scanZombieInternalSubgraphs = (
  collector: InventoryFindingCollector,
  graph: ZombieDeclarationLiveGraph,
  zombieLawId: string,
  antiEvasionLawId: string,
): { orphanDeclarationCount: number } => {
  let orphanDeclarationCount = pushUnprovenLivenessFinding(collector, graph, antiEvasionLawId);

  for (const declaration of graph.declarations) {
    if (!graph.deadDeclarationIds.has(declaration.id) || declaration.isExported) {
      continue;
    }
    const checkId = resolveDeclarationCheckId(graph, declaration.id);
    pushZombieFinding(collector, {
      checkId,
      declarationKind: declaration.declarationKind,
      governedFile: declaration.governedFile,
      lawId: zombieLawId,
      reason: checkId === "code-purity/dead-export-helper-subgraph"
        ? `Top-level ${declaration.declarationKind} ${declaration.name} is only reachable from a dead exported subgraph and has no live runtime root.`
        : checkId === "code-purity/dead-internal-declaration-subgraph"
          ? `Top-level ${declaration.declarationKind} ${declaration.name} survives only inside a dead internal declaration subgraph.`
          : `Top-level ${declaration.declarationKind} ${declaration.name} has no live runtime-rooted reference in the reachable graph.`,
      remediation: "Delete the declaration or reconnect it to a real runtime-rooted live consumer.",
      symbolName: declaration.name,
      message: checkId === "code-purity/dead-export-helper-subgraph"
        ? `${declaration.governedFile.repoPath} keeps dead helper ${declaration.name} alive only through a dead export subgraph.`
        : checkId === "code-purity/dead-internal-declaration-subgraph"
          ? `${declaration.governedFile.repoPath} keeps dead internal declaration subgraph member ${declaration.name}.`
          : `${declaration.governedFile.repoPath} keeps an orphan top-level ${declaration.declarationKind} named ${declaration.name}.`,
    });
    orphanDeclarationCount += 1;
  }

  return { orphanDeclarationCount };
};