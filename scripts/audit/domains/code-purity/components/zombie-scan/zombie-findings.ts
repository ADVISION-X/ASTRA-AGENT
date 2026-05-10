import { createFinding } from "../../../../core/result.js";
import type { Finding } from "../../../../core/schema.js";

import type { ZombieCandidate, ZombieGraph } from "./zombie-scan-types.js";

const FILE_SCOPED_ZOMBIE_KINDS = new Set<ZombieCandidate["kind"]>([
  "orphan-file",
  "dead-export",
  "unused-child-capability",
  "unused-inspector-component",
]);

const resolveZombieFindingMessage = (candidate: ZombieCandidate): string => {
  switch (candidate.kind) {
    case "orphan-file":
      return `Orphan file ${candidate.symbolName} has no lawful callers.`;
    case "dead-export":
      return `Export ${candidate.symbolName} has no lawful callers.`;
    case "unused-child-capability":
      return `Child capability ${candidate.symbolName} has no lawful callers.`;
    case "unused-inspector-component":
      return `Inspector component ${candidate.symbolName} has no lawful callers.`;
    case "unused-prompt-contract":
      return `Prompt contract ${candidate.symbolName} has no lawful callers.`;
    case "unused-route-plan-step":
      return `Route plan step ${candidate.symbolName} has no lawful callers.`;
    case "unused-map-package":
      return `Map package ${candidate.symbolName} is not loaded by a lawful owner.`;
    case "unused-muscle-memory-action-code":
      return `Muscle-memory action code ${candidate.symbolName} has no lawful callers.`;
  }
};

export const resolveZombieCallerCount = (graph: ZombieGraph, candidate: ZombieCandidate): number => {
  if (FILE_SCOPED_ZOMBIE_KINDS.has(candidate.kind)) {
    return graph.inboundImportPaths.get(candidate.file)?.size ?? 0;
  }
  if (!candidate.value) {
    return 0;
  }
  return graph.stringUsageIndex.get(candidate.value)?.size ?? 0;
};

export const buildZombieFinding = (candidate: ZombieCandidate, lawfulCallerCount: number): Finding =>
  createFinding({
    lawId: "GRASSEYE-CODE-PURITY-ZOMBIE-001-V1",
    file: candidate.file,
    line: candidate.line,
    severity: "fatal",
    message: resolveZombieFindingMessage(candidate),
    zombieKind: candidate.kind,
    symbolName: candidate.symbolName,
    lawfulCallerCount,
    protectedSeam: candidate.protectedSeam ?? "none",
    recommendedAction: candidate.recommendedAction,
  });
