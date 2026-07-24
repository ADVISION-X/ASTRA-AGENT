import type { SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { hasAstNameOrLiteral, hasIdentifierName, hasPropertyAccessSegments } from "./deep-research-ast-facts.js";

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

  if (!hasPropertyAccessSegments(input.finalizationFile, ["fullCaseFile", "researchPlan", "finalAdjudicationPromptBundle"])) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-runtime-path",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Final adjudication stage must consume fullCaseFile.researchPlan.finalAdjudicationPromptBundle.",
    }));
  }

  for (const marker of ["structuredIndex", "fullCaseFileMarkdown"]) {
    if (hasAstNameOrLiteral(input.finalizationFile, marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-runtime",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: `Final adjudication stage is missing required input marker: ${marker}.`,
    }));
  }

  for (const marker of [
    "finalAdjudicationPromptBundle",
    "DeepResearchPromptBundle",
    "structuredIndex",
    "DeepResearchStructuredIndex",
    "fullCaseFileMarkdown",
  ]) {
    if (hasAstNameOrLiteral(input.finalAdjudicationPromptFile, marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-prompt",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: `Final adjudication prompt is missing ${marker}.`,
    }));
  }

  if (hasIdentifierName(input.finalAdjudicationPromptFile, "buildDefaultFinalAdjudicationPromptBundle")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-promptbundle-input-default-builder",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: "Final adjudication runtime must not contain an obsolete replacement prompt builder.",
    }));
  }
};
