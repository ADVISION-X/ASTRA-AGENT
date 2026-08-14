import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isOwnerInspectorRepoPath, normalizeAuditTruthPath } from "./audit-truth-scope.js";

const runnerPath = "scripts/audit/core/run-generated-plan.ts";
const workerPath = "scripts/audit/core/run-generated-plan-worker.ts";

const importsGeneratedPlanRuntime = (sourceFile: SourceFile): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = declaration.getModuleSpecifierSourceFile();
    const targetsRunner = targetPath
      ? normalizeAuditTruthPath(getRepoSourcePath(targetPath)) === runnerPath
      : declaration.getModuleSpecifierValue().includes("core/run-generated-plan");
    if (!targetsRunner || declaration.isTypeOnly()) return false;
    return declaration.getNamespaceImport() !== undefined
      || declaration.getDefaultImport() !== undefined
      || declaration.getNamedImports().some((specifier) => !specifier.isTypeOnly());
  });

const workerImportIsExact = (sourceFile: SourceFile): boolean => {
  const runtimeImports = sourceFile.getImportDeclarations().filter((declaration) => {
    const targetPath = declaration.getModuleSpecifierSourceFile();
    return targetPath
      ? normalizeAuditTruthPath(getRepoSourcePath(targetPath)) === runnerPath
      : declaration.getModuleSpecifierValue().includes("core/run-generated-plan");
  });
  return runtimeImports.length === 1
    && runtimeImports[0]?.getNamespaceImport() === undefined
    && runtimeImports[0]?.getDefaultImport() === undefined
    && runtimeImports[0]?.getNamedImports().length === 1
    && runtimeImports[0]?.getNamedImports()[0]?.getName() === "runGeneratedPlan"
    && runtimeImports[0]?.getNamedImports()[0]?.isTypeOnly() === false;
};

const runnerHasOnlyCanonicalRuntimeExport = (sourceFile: SourceFile): boolean =>
  [...sourceFile.getExportedDeclarations()].every(([name, declarations]) =>
    name === "runGeneratedPlan" || declarations.every((declaration) =>
      Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration)));

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
  const inspectorPathSet = new Set(inspectorPaths);
  const generatedPlanPathCounts = countPaths(input.context.generatedPlan.map((entry) => entry.ownerInspectorPath));

  for (const sourceFile of input.context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    const normalizedPath = normalizeAuditTruthPath(repoPath);
    if (!normalizedPath.startsWith("scripts/audit/")) continue;
    input.inspectedFiles.add(repoPath);
    const invalidRunnerSource = normalizedPath === runnerPath && !runnerHasOnlyCanonicalRuntimeExport(sourceFile);
    const invalidRuntimeImport = normalizedPath === workerPath
      ? !workerImportIsExact(sourceFile)
      : importsGeneratedPlanRuntime(sourceFile);
    if (!invalidRunnerSource && !invalidRuntimeImport) continue;
    findings.push(
      createFinding({
        checkId: "audit-truth/ci-owner-special-case",
        lawId: input.lawId,
        filePath: repoPath,
        message: `${repoPath} exposes or imports generated-plan execution outside the one complete worker-owned runner path.`,
      }),
    );
  }

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

  for (const planEntry of input.context.generatedPlan) {
    input.inspectedFiles.add(planEntry.manifestPath);
    input.inspectedFiles.add(planEntry.ownerInspectorPath);
    if (inspectorPathSet.has(planEntry.ownerInspectorPath)) {
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
