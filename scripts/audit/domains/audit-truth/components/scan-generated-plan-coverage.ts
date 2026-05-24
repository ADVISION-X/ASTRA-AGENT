import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const normalizeAuditTruthPath = (repoPath: string): string => {
  if (repoPath.startsWith("scripts/")) {
    return repoPath;
  }
  const markerIndex = repoPath.indexOf("/scripts/");
  return markerIndex >= 0 ? repoPath.slice(markerIndex + 1) : repoPath;
};

const isOwnerInspectorPath = (repoPath: string): boolean =>
  /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u.test(normalizeAuditTruthPath(repoPath));

const listOwnerInspectorPaths = (context: InspectorContext): string[] =>
  context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile())
    .map((sourceFile) => getRepoSourcePath(sourceFile))
    .filter((repoPath) => isOwnerInspectorPath(repoPath))
    .sort((left, right) => left.localeCompare(right));

export const scanGeneratedPlanCoverage = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const inspectorPaths = new Set(listOwnerInspectorPaths(input.context));
  const generatedPlanPaths = new Set(input.context.generatedPlan.map((entry) => entry.ownerInspectorPath));

  for (const inspectorPath of inspectorPaths) {
    input.inspectedFiles.add(inspectorPath);
    if (generatedPlanPaths.has(inspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/missing-generated-plan-entry",
        lawId: input.lawId,
        filePath: inspectorPath,
        message: `${inspectorPath} exists in the project but is missing from the generated plan.`,
      }),
    );
  }

  for (const planEntry of input.context.generatedPlan) {
    input.inspectedFiles.add(planEntry.manifestPath);
    input.inspectedFiles.add(planEntry.ownerInspectorPath);
    if (inspectorPaths.has(planEntry.ownerInspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/orphan-generated-plan-entry",
        lawId: input.lawId,
        filePath: planEntry.ownerInspectorPath,
        message: `Generated plan references owner inspector ${planEntry.ownerInspectorPath} that is not present in the project.`,
      }),
    );
  }

  return { findings };
};