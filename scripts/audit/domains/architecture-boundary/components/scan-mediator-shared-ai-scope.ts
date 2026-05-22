import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import {
  findPlannerToken,
  isPlannerScope,
  privateCapabilityPathPattern,
  type ArchitectureSourceFile,
} from "./architecture-boundary-shared.js";

const pushBoundaryFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    lawId: string;
    repoPath: string;
    targetPath?: string;
    message: string;
  },
): void => {
  findings.push(
    createFinding({
      checkId: input.checkId,
      lawId: input.lawId,
      filePath: input.repoPath,
      evidence: input.targetPath,
      message: input.message,
    }),
  );
};

export const inspectMediatorImports = (
  findings: InspectorFinding[],
  mediatorLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!repoPath.startsWith("src/mediator/")) {
    return;
  }
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (
      !targetPath.startsWith("src/lib/browser/") &&
      !targetPath.startsWith("src/capabilities/") &&
      !privateCapabilityPathPattern.test(targetPath)
    ) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/mediator-runtime-import",
      lawId: mediatorLawId,
      repoPath,
      targetPath,
      message: `${repoPath} imports runtime action surface ${targetPath}.`,
    });
  }
};

export const inspectSharedImports = (
  findings: InspectorFinding[],
  sharedLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!repoPath.startsWith("src/lib/") || repoPath.startsWith("src/lib/local-runtime/")) {
    return;
  }
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/shared-owner-boundary",
      lawId: sharedLawId,
      repoPath,
      targetPath,
      message: `${repoPath} imports owner code ${targetPath} from shared infrastructure.`,
    });
  }
};

export const inspectPlannerScope = (
  findings: InspectorFinding[],
  plannerLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!isPlannerScope(repoPath)) {
    return;
  }
  const plannerToken = findPlannerToken(sourceFile);
  if (!plannerToken) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "architecture/ai-planner-ban",
      lawId: plannerLawId,
      filePath: repoPath,
      message: `${repoPath} contains planner token ${plannerToken}.`,
    }),
  );
};