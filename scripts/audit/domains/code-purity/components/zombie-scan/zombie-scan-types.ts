import type { Project, SourceFile } from "ts-morph";

export const ZOMBIE_KINDS = [
  "orphan-file",
  "dead-export",
  "unused-child-capability",
  "unused-prompt-contract",
  "unused-route-plan-step",
  "unused-map-package",
  "unused-inspector-component",
  "unused-muscle-memory-action-code",
] as const;

export type ZombieKind = (typeof ZOMBIE_KINDS)[number];

export type ZombieCandidate = {
  kind: ZombieKind;
  symbolName: string;
  file: string;
  line: number;
  value?: string;
  excludedFiles: string[];
  excludedPathPrefixes: string[];
  protectedSeam: string | null;
  recommendedAction: string;
};

export type ZombieGraph = {
  project: Project;
  sourceFilesByPath: Map<string, SourceFile>;
  sourcePaths: string[];
  jsonPaths: string[];
  inboundImportPaths: Map<string, Set<string>>;
  stringUsageIndex: Map<string, Set<string>>;
};
