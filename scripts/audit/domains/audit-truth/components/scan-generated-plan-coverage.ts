import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isOwnerInspectorRepoPath } from "./audit-truth-scope.js";

const listOwnerInspectorPaths = (context: InspectorContext): string[] =>
  context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile())
    .map((sourceFile) => getRepoSourcePath(sourceFile))
    .filter((repoPath) => isOwnerInspectorRepoPath(repoPath))
    .sort((left, right) => left.localeCompare(right));

const countPaths = (paths: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const path of paths) counts.set(path, (counts.get(path) ?? 0) + 1);
  return counts;
};

export const scanGeneratedPlanCoverage = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const inspectorPaths = listOwnerInspectorPaths(input.context);
  const generatedPlanPathCounts = countPaths(input.context.generatedPlan.map((entry) => entry.ownerInspectorPath));

  for (const inspectorPath of inspectorPaths) {
    input.inspectedFiles.add(inspectorPath);
    const generatedCount = generatedPlanPathCounts.get(inspectorPath) ?? 0;
    if (generatedCount === 1) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: generatedCount === 0
          ? "audit-truth/missing-generated-plan-entry"
          : "audit-truth/duplicate-generated-plan-entry",
        lawId: input.lawId,
        filePath: inspectorPath,
        message: generatedCount === 0
          ? `${inspectorPath} exists in the project but is missing from the generated plan.`
          : `${inspectorPath} appears ${generatedCount} times in the generated plan and must appear exactly once.`,
      }),
    );
  }

  for (const planEntry of input.context.generatedPlan) input.inspectedFiles.add(planEntry.manifestPath);

  return { findings };
};
