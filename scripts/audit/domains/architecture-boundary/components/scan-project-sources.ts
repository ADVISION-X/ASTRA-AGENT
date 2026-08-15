import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import type { ArchitectureLawIds } from "./architecture-boundary-shared.js";
import { inspectCapabilityImports, inspectChildAbilityImports, inspectPluginBoundaries } from "./scan-plugin-capability-boundaries.js";
import { inspectMediatorImports, inspectPlannerScope, inspectSharedImports } from "./scan-mediator-shared-ai-scope.js";

const isTrueLiteral = (node: Node | undefined): boolean =>
  node?.getKind() === SyntaxKind.TrueKeyword;

const isGovernedProductionPath = (repoPath: string): boolean =>
  repoPath.startsWith("src/plugins/")
  || repoPath.startsWith("src/capabilities/")
  || repoPath.startsWith("src/lib/browser/");

const firstBreakBoundary = (node: Node): Node | undefined => {
  let current = node.getParent();
  while (current) {
    if (Node.isWhileStatement(current) || Node.isDoStatement(current)
      || Node.isForStatement(current) || Node.isForInStatement(current)
      || Node.isForOfStatement(current) || Node.isSwitchStatement(current)) return current;
    current = current.getParent();
  }
  return undefined;
};

const belongsToLoopFunction = (node: Node, loop: Node): boolean => {
  let current = node.getParent();
  while (current && current !== loop) {
    if (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)
      || Node.isArrowFunction(current) || Node.isMethodDeclaration(current)) return false;
    current = current.getParent();
  }
  return current === loop;
};

const hasExplicitLoopExit = (loop: Node): boolean => {
  const breaks = loop.getDescendantsOfKind(SyntaxKind.BreakStatement)
    .some((statement) => firstBreakBoundary(statement) === loop);
  if (breaks) return true;
  return [
    ...loop.getDescendantsOfKind(SyntaxKind.ReturnStatement),
    ...loop.getDescendantsOfKind(SyntaxKind.ThrowStatement),
  ].some((statement) => belongsToLoopFunction(statement, loop));
};

const inspectBoundedBrowserProductionStages = (
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!isGovernedProductionPath(repoPath)) return;

  const unboundedLoops: Node[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)
      .filter((statement) => isTrueLiteral(statement.getExpression())),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.DoStatement)
      .filter((statement) => isTrueLiteral(statement.getExpression())),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)
      .filter((statement) => statement.getCondition() === undefined),
  ].filter((loop) => !hasExplicitLoopExit(loop));
  for (const loop of unboundedLoops) {
    findings.push(createFinding({
      checkId: "architecture/unbounded-production-stage",
      lawId,
      filePath: repoPath,
      line: loop.getStartLineNumber(),
      message: `${repoPath} contains a truly unbounded production loop with no explicit break, return or throw exit; use an explicit maximum count or deadline and fail closed on exhaustion.`,
    }));
  }
};

const inspectSourceFile = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  lawIds: ArchitectureLawIds,
): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  inspectedFiles.add(repoPath);
  inspectPluginBoundaries(findings, lawIds.jobFlowLawId, repoPath, sourceFile);
  inspectMediatorImports(findings, lawIds.mediatorLawId, repoPath, sourceFile);
  inspectCapabilityImports(findings, lawIds.capabilityLawId, repoPath, sourceFile);
  inspectChildAbilityImports(findings, lawIds.childAbilityLawId, repoPath, sourceFile);
  inspectSharedImports(findings, lawIds.sharedLawId, repoPath, sourceFile);
  inspectPlannerScope(findings, lawIds.plannerLawId, repoPath, sourceFile);
  inspectBoundedBrowserProductionStages(findings, lawIds.productionBoundaryLawId, repoPath, sourceFile);
};

export const inspectProjectSources = (
  project: InspectorContext["project"],
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawIds: ArchitectureLawIds,
): void => {
  for (const sourceFile of listActiveSourceFiles(project)) {
    inspectSourceFile(findings, inspectedFiles, sourceFile, lawIds);
  }
};
