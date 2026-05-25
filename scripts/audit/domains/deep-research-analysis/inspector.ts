import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectDeleteRetiredDeepResearchPaths } from "./components/scan-delete-retired-deep-research-paths.js";
import { inspectFullCaseFileRequired } from "./components/scan-full-case-file-required.js";
import { inspectHtmlOnlyFinalArtifact } from "./components/scan-html-only-final-artifact.js";
import { inspectRetiredFlowSymbols } from "./components/scan-retired-flow-symbols.js";
import { inspectSingleFlowSovereignty } from "./components/scan-single-flow-sovereignty.js";

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
  inspectSingleFlowSovereignty({
    analysisRunnerFile: getSourceFile(context, requiredFiles[0]),
    finalPackageFile: getSourceFile(context, requiredFiles[1]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-038-V1"),
  });
  inspectDeleteRetiredDeepResearchPaths({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-039-V1"),
  });
  inspectFullCaseFileRequired({
    finalAdjudicationPromptFile: getSourceFile(context, requiredFiles[5]),
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    fullCaseFileFile: getSourceFile(context, requiredFiles[2]),
    exportFile: getSourceFile(context, requiredFiles[7]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-040-V1"),
  });
  inspectHtmlOnlyFinalArtifact({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-041-V1"),
  });
    inspectRetiredFlowSymbols({
    sourceFiles,
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
