import { stableJsonHash } from "../../lib/storage/hash.js";

import {
  type DeepResearchPrompt,
  type DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchInput, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  renderDecompositionPrompt,
} from "./deep-research-analysis.decomposition-prompt.js";
import { renderSubQuestionAnalysisFromPromptBundle } from "./deep-research-analysis.prompt-bundle-render.js";

const FORBIDDEN_CONTROL_FIELDS = [
  "contractId",
  "format",
  "browserCommand",
  "selector",
  "coordinate",
  "workflow",
  "multiStepPlan",
  "runNext",
  "databaseCommand",
  "filePath",
  "followUpAction",
  "executionDirective",
] as const;

export const buildPromptOutputShellContract = (input: {
  contractId: string;
  format?: DeepResearchPromptOutputContract["format"];
  requiredFields?: string[];
}): DeepResearchPromptOutputContract => ({
  contractId: input.contractId,
  format: input.format ?? "json_object",
  requiredFields: input.requiredFields ?? ["raw content preserved"],
  forbiddenFields: [...FORBIDDEN_CONTROL_FIELDS],
});

const buildPromptDocument = (sections: readonly (string | null | undefined)[]): string =>
  sections
    .filter((section): section is string => typeof section === "string" && section.trim().length > 0)
    .join("\n\n");

export const buildDecompositionPrompt = (): DeepResearchPrompt => ({
  promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
  promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
  phase: "decomposition",
  promptText: DEEP_RESEARCH_DECOMPOSITION_PROMPT.text,
  expectedOutputContract: buildPromptOutputShellContract({
    contractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
    requiredFields: [
      "mainQuestion",
      "questionType",
      "decompositionStrategy",
      "missingInfo",
      "subQuestions",
      "finalAdjudicationPromptBundle",
      "htmlReportPromptBundle",
      "planIntegrityCheck",
    ],
  }),
});

export const buildRenderedDeepResearchPromptHash = (input: {
  prompt: DeepResearchPrompt;
  renderedPromptText: string;
}): string =>
  stableJsonHash({
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    phase: input.prompt.phase,
    promptText: input.renderedPromptText,
    expectedOutputContract: input.prompt.expectedOutputContract,
  });

export const renderDeepResearchDecompositionPrompt = (input: Pick<DeepResearchInput, "userQuestion" | "analysisGoal" | "language" | "maxSubQuestions">): string =>
  buildPromptDocument([
    renderDecompositionPrompt({
      userQuestion: input.userQuestion,
      maxSubQuestions: input.maxSubQuestions,
      language: input.language,
      questionTypeHint: "general",
    }),
    input.analysisGoal ? `Analysis goal:\n${input.analysisGoal}` : null,
  ]);

export const requireSubQuestionPromptBundle = (
  subQuestion: DeepResearchSubQuestion,
): NonNullable<DeepResearchSubQuestion["promptBundle"]> => {
  const promptBundle = subQuestion.promptBundle;
  if (!promptBundle) {
    throw new Error(`Missing promptBundle for sub-question ${subQuestion.id}.`);
  }
  return promptBundle;
};
