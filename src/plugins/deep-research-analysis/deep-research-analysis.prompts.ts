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
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
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

export const decompositionPrompt: DeepResearchPrompt = {
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
};

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

export const subQuestionAnalysisPrompt: DeepResearchPrompt = {
  promptId: "deep-research.sub-question-analysis",
  promptVersion: "v2.0.0",
  phase: "analysis",
  promptText: "Runtime shell for AI-generated sub-question promptBundle.",
  expectedOutputContract: buildPromptOutputShellContract({
    contractId: "deep-research.sub-question-analysis.shell.v2.0",
  }),
};

const buildDefaultSubQuestionPromptBundle = (input: {
  id: string;
  title: string;
  questionText: string;
  language: DeepResearchInput["language"];
}): DeepResearchPromptBundle => ({
  promptBundleId: `${input.id}-default-prompt-bundle`,
  promptRole: "sub_question_analysis",
  taskInstruction: `Analyze this sub-question: ${input.questionText}`,
  questionSpecificFocus: [input.title],
  mustUseInputs: ["userQuestion", "analysisGoal", "subQuestion"],
  mustNotDo: ["Do not issue browser commands.", "Do not invent evidence."],
  evidenceOrReasoningNeeds: ["State claims, evidence mentions, assumptions, limitations, and counter conditions."],
  outputGuidance: {
    preferredFormat: "json_object",
    requiredContent: ["answer", "coreFinding", "keyClaims", "confidence", "limitations"],
    optionalContent: ["failureCases", "uncertainties"],
    forbiddenContent: ["workflow instructions"],
  },
  safetyBoundary: ["This is analysis only."],
  languageInstruction: input.language === "zh-CN" ? "Respond in Simplified Chinese." : "Respond in English.",
});

export const renderDeepResearchSubQuestionAnalysisPrompt = (input: Pick<DeepResearchInput, "userQuestion" | "analysisGoal" | "language"> & {
  subQuestion: DeepResearchSubQuestion;
}): string => renderSubQuestionAnalysisFromPromptBundle({
  userQuestion: input.userQuestion,
  analysisGoal: input.analysisGoal,
  language: input.language,
  subQuestion: input.subQuestion,
  promptBundle: input.subQuestion.promptBundle ?? buildDefaultSubQuestionPromptBundle({
    id: input.subQuestion.id,
    title: input.subQuestion.title,
    questionText: input.subQuestion.questionText,
    language: input.language,
  }),
});
