import { createFinding } from "../../../../core/result.js";
import type { Finding } from "../../../../core/schema.js";

import type { ZombieCandidate, ZombieGraph } from "./zombie-scan-types.js";

const FILE_SCOPED_ZOMBIE_KINDS = new Set<ZombieCandidate["kind"]>([
  "orphan-file",
  "dead-export",
  "unused-child-capability",
  "unused-inspector-component",
]);

const ZOMBIE_MESSAGE_BUILDERS: Record<ZombieCandidate["kind"], (symbolName: string) => string> = {
  "orphan-file": (symbolName) => `Orphan file ${symbolName} has no lawful callers.`,
  "dead-export": (symbolName) => `Export ${symbolName} has no lawful callers.`,
  "unused-child-capability": (symbolName) => `Child capability ${symbolName} has no lawful callers.`,
  "unused-inspector-component": (symbolName) => `Inspector component ${symbolName} has no lawful callers.`,
  "unused-prompt-contract": (symbolName) => `Prompt contract ${symbolName} has no lawful callers.`,
  "unused-route-plan-step": (symbolName) => `Route plan step ${symbolName} has no lawful callers.`,
  "unused-map-package": (symbolName) => `Map package ${symbolName} is not loaded by a lawful owner.`,
  "unused-muscle-memory-action-code": (symbolName) => `Muscle-memory action code ${symbolName} has no lawful callers.`,
};

const resolveZombieFindingMessage = (candidate: ZombieCandidate): string => {
  return ZOMBIE_MESSAGE_BUILDERS[candidate.kind](candidate.symbolName);
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
