import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import type { ArchitectureLawIds } from "./architecture-boundary-shared.js";
import { inspectCapabilityImports, inspectChildAbilityImports, inspectPluginBoundaries } from "./scan-plugin-capability-boundaries.js";
import { inspectMediatorImports, inspectPlannerScope, inspectSharedImports } from "./scan-mediator-shared-ai-scope.js";

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