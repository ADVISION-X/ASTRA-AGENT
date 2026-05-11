import { createFinding } from "../../../../core/result.js";
import type { Finding } from "../../../../core/schema.js";

import type { ZombieCandidate, ZombieGraph } from "./zombie-scan-types.js";

const FILE_SCOPED_ZOMBIE_KINDS = new Set<ZombieCandidate["kind"]>([
  "orphan-file",
  "unused-inspector-component",
]);

const countLawfulCallerPaths = (paths: Iterable<string>, candidate: ZombieCandidate): number => {
  const callers = new Set<string>();

  for (const path of paths) {
    if (candidate.excludedFiles.includes(path)) {
      continue;
    }
    if (candidate.excludedPathPrefixes.some((prefix) => path.startsWith(prefix))) {
      continue;
    }
    callers.add(path);
  }

  return callers.size;
};

const collectValueCallerPaths = (graph: ZombieGraph, candidate: ZombieCandidate): Set<string> => {
  const callers = new Set<string>();
  const values = candidate.referenceValues ?? (candidate.value ? [candidate.value] : []);

  for (const value of values) {
    for (const path of graph.stringUsageIndex.get(value) ?? []) {
      callers.add(path);
    }
  }

  return callers;
};

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
  if (candidate.referencePaths?.length) {
    return countLawfulCallerPaths(candidate.referencePaths ?? [], candidate);
  }
  if (FILE_SCOPED_ZOMBIE_KINDS.has(candidate.kind)) {
    return countLawfulCallerPaths(graph.inboundImportPaths.get(candidate.file) ?? [], candidate);
  }
  if (!candidate.value && !candidate.referenceValues?.length) {
    return 0;
  }
  return countLawfulCallerPaths(collectValueCallerPaths(graph, candidate), candidate);
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
