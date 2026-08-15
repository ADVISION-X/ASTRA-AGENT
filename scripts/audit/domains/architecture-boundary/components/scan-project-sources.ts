import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import type { ArchitectureLawIds } from "./architecture-boundary-shared.js";
import { inspectCapabilityImports, inspectChildAbilityImports, inspectPluginBoundaries } from "./scan-plugin-capability-boundaries.js";
import { inspectMediatorImports, inspectPlannerScope, inspectSharedImports } from "./scan-mediator-shared-ai-scope.js";

const importsBrowserTargetSession = (sourceFile: Parameters<typeof getRepoSourcePath>[0]): boolean =>
  sourceFile.getImportDeclarations().some((declaration) =>
    declaration.getNamedImports().some((namedImport) => namedImport.getName() === "BrowserTargetSession"));

const isTrueLiteral = (node: Node | undefined): boolean =>
  node?.getKind() === SyntaxKind.TrueKeyword;

const inspectBoundedBrowserProductionStages = (
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if ((!repoPath.startsWith("src/plugins/") && !repoPath.startsWith("src/capabilities/"))
    || !importsBrowserTargetSession(sourceFile)) return;

  const unboundedLoops: Node[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)
      .filter((statement) => isTrueLiteral(statement.getExpression())),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.DoStatement)
      .filter((statement) => isTrueLiteral(statement.getExpression())),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)
      .filter((statement) => statement.getCondition() === undefined),
  ];
  for (const loop of unboundedLoops) {
    findings.push(createFinding({
      checkId: "architecture/unbounded-browser-production-stage",
      lawId,
      filePath: repoPath,
      line: loop.getStartLineNumber(),
      message: `${repoPath} contains an unconditional loop in a BrowserTargetSession-dependent production file; use an explicit maximum count or deadline and fail closed on exhaustion.`,
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
