import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectDeletedNonPrimaryPaths } from "./components/scan-deleted-non-primary-paths.js";
import { inspectFullCaseFileSovereignty } from "./components/scan-full-case-file-sovereignty.js";
import { inspectHtmlReportOnlyArtifact } from "./components/scan-html-report-only-artifact.js";
import { inspectNoDeadCodeAdjudication } from "./components/scan-no-dead-code-adjudication.js";
import { inspectNoPresentationArtifacts } from "./components/scan-no-presentation-artifacts.js";
import { inspectSingleChainSovereignty } from "./components/scan-single-chain-sovereignty.js";

const requiredFiles = [
  "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-render.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-export.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
] as const;

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(resolveFromRepo(repoPath)));

const inspectRequiredFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "deep-research/required-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the single Deep Research main flow.`,
    }));
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-001-V1");
  const sourceFiles = context.project.getSourceFiles("src/plugins/deep-research-analysis/**/*.ts");
  sourceFiles.forEach((sourceFile) => inspectedFiles.add(getRepoSourcePath(sourceFile)));
  inspectRequiredFiles(findings, inspectedFiles, lawId);
  inspectSingleChainSovereignty({
    analysisRunnerFile: getSourceFile(context, requiredFiles[0]),
    finalPackageFile: getSourceFile(context, requiredFiles[1]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-038-V1"),
  });
  inspectDeletedNonPrimaryPaths({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-039-V1"),
  });
  inspectFullCaseFileSovereignty({
    finalAdjudicationPromptFile: getSourceFile(context, requiredFiles[5]),
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    fullCaseFileFile: getSourceFile(context, requiredFiles[2]),
    exportFile: getSourceFile(context, requiredFiles[7]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-040-V1"),
  });
  inspectHtmlReportOnlyArtifact({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-041-V1"),
  });
  inspectNoPresentationArtifacts({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-041-V1"),
  });
  inspectNoDeadCodeAdjudication({
    sourceFiles,
    fullCaseFileFile: getSourceFile(context, requiredFiles[2]),
    finalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
    parserSupportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-042-V1"),
  });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
