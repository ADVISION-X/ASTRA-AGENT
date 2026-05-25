import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const markInspected = (inspectedFiles: Set<string>, sourceFiles: readonly (SourceFile | undefined)[]): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectFinalAdjudicationFullInput = (input: {
  analysisRunnerFile: SourceFile | undefined;
  analysisFinalizationFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [
    input.analysisRunnerFile,
    input.analysisFinalizationFile,
    input.finalAdjudicationPromptFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  const finalizationText = input.analysisFinalizationFile?.getFullText() ?? "";
  for (const marker of ["buildDeepResearchFullCaseFile", "fullCaseFileMarkdown", "full-case-file"]) {
    if (finalizationText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-full-input-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: `Final adjudication integration must include ${marker}.`,
    }));
  }

  const finalPromptCall = input.analysisFinalizationFile
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "renderDeepResearchFinalAdjudicationPrompt");
  const finalPromptPayload = finalPromptCall?.getArguments()[0];
  if (!Node.isObjectLiteralExpression(finalPromptPayload)) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-full-input-payload",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Final adjudication prompt must use an object literal payload.",
    }));
  } else {
    for (const propertyName of ["fullCaseFile", "fullCaseFileMarkdown"]) {
      if (finalPromptPayload.getProperty(propertyName)) {
        continue;
      }
      input.findings.push(createFinding({
        checkId: "deep-research/final-adjudication-full-input-property",
        lawId: input.lawId,
        filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
        message: `Final adjudication prompt payload must include ${propertyName}.`,
      }));
    }
  }

  const runnerText = input.analysisRunnerFile?.getFullText() ?? "";
  for (const marker of ["finalPackageStage.fullCaseFile", "finalPackageStage.fullCaseFileMarkdown"]) {
    if (runnerText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-runner-input",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
      message: `Analysis runner must thread ${marker} into the final adjudication path.`,
    }));
  }

  const promptText = input.finalAdjudicationPromptFile?.getFullText() ?? "";
  for (const marker of [
    "The full case file is the complete source of truth.",
    "If structured fields and raw responses differ, use the raw responses as primary evidence.",
    "Do not ignore raw responses that failed parsing.",
  ]) {
    if (promptText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-prompt-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
      message: `Final adjudication prompt must include marker: ${marker}.`,
    }));
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  if (!acceptanceText.includes("renderDeepResearchFinalAdjudicationPrompt") || !acceptanceText.includes("fullCaseFileMarkdown")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-acceptance",
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-final-adjudication-full-input.acceptance.ts",
      message: "Final adjudication full-input acceptance must assert rendered prompt ownership and full case file inputs.",
    }));
  }

  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-final-adjudication-full-input")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-final-adjudication-full-input.",
    }));
  }
};