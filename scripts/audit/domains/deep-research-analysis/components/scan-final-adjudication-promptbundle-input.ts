import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, path: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === path);

export const inspectFinalAdjudicationPromptBundleInput = (input: {
  finalizationFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.finalizationFile, input.finalAdjudicationPromptFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  if (!hasPropertyAccessPath(input.finalizationFile, "fullCaseFile.researchPlan.finalAdjudicationPromptBundle")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-runtime-path",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Final adjudication stage must consume fullCaseFile.researchPlan.finalAdjudicationPromptBundle.",
    }));
  }

  const finalizationText = input.finalizationFile?.getFullText() ?? "";
  for (const marker of ["structuredIndex: finalPackage", "fullCaseFileMarkdown"]) {
    if (finalizationText.includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-runtime",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: `Final adjudication stage is missing required input marker: ${marker}.`,
    }));
  }

  const promptText = input.finalAdjudicationPromptFile?.getFullText() ?? "";
  for (const marker of [
    "Runtime shell for AI-generated finalAdjudicationPromptBundle.",
    "finalAdjudicationPromptBundle: DeepResearchPromptBundle",
    "structuredIndex: DeepResearchStructuredIndex",
    "fullCaseFileMarkdown",
  ]) {
    if (promptText.includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-prompt",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
      message: `Final adjudication prompt is missing ${marker}.`,
    }));
  }

  if (promptText.includes("buildDefaultFinalAdjudicationPromptBundle")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-default-builder",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
      message: "Final adjudication runtime must not contain an obsolete replacement prompt builder.",
    }));
  }
};