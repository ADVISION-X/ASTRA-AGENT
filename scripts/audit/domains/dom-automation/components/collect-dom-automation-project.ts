import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Project, SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { getAuditProject } from "../../../core/ts-morph.js";
import { PLUGIN_CONSUMER_ROOTS } from "../dom-automation-binary-constants.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/;

const walkRepoFiles = (repoPath: string, acc: string[] = []): string[] => {
  const absolutePath = pathFromRepoRoot(repoPath);
  if (!existsSync(absolutePath)) {
    return acc;
  }
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const childAbsolutePath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkRepoFiles(toRepoRelativePath(childAbsolutePath), acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
      acc.push(childAbsolutePath);
    }
  }
  return acc;
};

const loadSourceFiles = (project: Project, repoPath: string): SourceFile[] =>
  walkRepoFiles(repoPath)
    .map((absolutePath) => project.addSourceFileAtPathIfExists(absolutePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));

const loadSourceFilesFromRoots = (project: Project, repoPaths: readonly string[]): SourceFile[] =>
  repoPaths.flatMap((repoPath) => loadSourceFiles(project, repoPath));

export const loadDomAutomationAuditProject = (): DomAutomationAuditProject => {
  const project = getAuditProject();
  return {
    project,
    sourceFiles: {
      dom: loadSourceFiles(project, "src/capabilities/dom-automation"),
      domRuntime: loadSourceFiles(project, "src/capabilities/dom-automation/runtime"),
      domContracts: loadSourceFiles(project, "src/capabilities/dom-automation/contracts"),
      plugin: loadSourceFilesFromRoots(project, PLUGIN_CONSUMER_ROOTS),
      visualMission: loadSourceFiles(project, "src/visual-mission"),
      browser: loadSourceFiles(project, "src/lib/browser"),
      muscleMemory: loadSourceFiles(project, "src/muscle-memory"),
      acceptance: loadSourceFiles(project, "scripts/acceptance"),
    },
  };
};

export const getSourceFileAtRepoPath = (
  project: Project,
  repoPath: string,
): SourceFile | null => project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoPath)) ?? null;
