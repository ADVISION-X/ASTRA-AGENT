import { stableJsonHash } from "../../lib/storage/hash.js";

import {
  type DeepResearchPrompt,
  type DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type {
  DeepResearchInput,
  DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import type {
  DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  renderDecompositionPrompt,
} from "./deep-research-analysis.decomposition-prompt.js";

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
] as const;

const buildOutputContract = (input: {
  contractId: string;
  requiredFields: string[];
}): DeepResearchPromptOutputContract => ({
  contractId: input.contractId,
  format: "json_object",
  requiredFields: input.requiredFields,
  forbiddenFields: [...FORBIDDEN_CONTROL_FIELDS],
});

const buildPrompt = (prompt: DeepResearchPrompt): DeepResearchPrompt => prompt;

const buildPromptDocument = (sections: readonly (string | null | undefined)[]): string =>
  sections
    .filter((section): section is string => typeof section === "string" && section.trim().length > 0)
    .join("\n\n");

const buildContractSection = (contract: DeepResearchPromptOutputContract): string =>
  JSON.stringify(contract, null, 2);

export const decompositionPrompt = buildPrompt({
  promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
  promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
  phase: "decomposition",
  promptText: DEEP_RESEARCH_DECOMPOSITION_PROMPT.text,
  expectedOutputContract: buildOutputContract({
    contractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
    requiredFields: [
      "mainQuestion",
      "questionType",
      "decompositionStrategy",
      "missingInfo",
      "subQuestions",
      "qualitySelfCheck",
    ],
  }),
});

export const positiveAnalysisPrompt = buildPrompt({
  promptId: "deep-research.positive-analysis",
  promptVersion: "v1.1.0",
  phase: "positive",
  promptText: [
    "You are an external researcher. Produce the strongest positive analysis for one sub-question.",
    "Return exactly one JSON object only.",
    "Do not wrap it in markdown.",
    "Do not include contractId or format.",
    "Do not include browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
    "The JSON root must contain exactly these fields: subQuestionId, answer, keyClaims, supportingReasons, assumptions, evidenceMentions, confidence, limitations.",
    "confidence must be exactly one of: \"low\", \"medium\", \"high\".",
    "Do not output numeric confidence.",
    "Do not output confidence as 0.8, 80, \"80%\", or \"high confidence\".",
    "Use this JSON shape: {\"subQuestionId\":\"the database subQuestionId from input\",\"answer\":\"positive analysis answer\",\"keyClaims\":[\"claim 1\"],\"supportingReasons\":[\"reason 1\"],\"assumptions\":[\"assumption 1\"],\"evidenceMentions\":[\"evidence mention 1\"],\"confidence\":\"medium\",\"limitations\":[\"limitation 1\"]}.",
    "Focus on supportive reasoning only.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.positive-analysis.json.v1",
    requiredFields: [
      "subQuestionId",
      "answer",
      "keyClaims",
      "supportingReasons",
      "assumptions",
      "evidenceMentions",
      "confidence",
      "limitations",
    ],
  }),
});

export const falsificationPrompt = buildPrompt({
  promptId: "deep-research.falsification",
  promptVersion: "v1.1.0",
  phase: "falsification",
  promptText: [
    "You are an external researcher. Produce the strongest falsification and opposing case for one sub-question.",
    "Return exactly one JSON object only.",
    "Do not wrap it in markdown.",
    "Do not include contractId or format.",
    "Do not include browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
    "The JSON root must contain exactly these fields: subQuestionId, answer, strongestOpposingArguments, contradictionPoints, evidenceMentions, confidence, limitations.",
    "confidence must be exactly one of: \"low\", \"medium\", \"high\".",
    "Do not output numeric confidence.",
    "Do not output confidence as 0.8, 80, \"80%\", or \"high confidence\".",
    "Use this JSON shape: {\"subQuestionId\":\"the database subQuestionId from input\",\"answer\":\"falsification answer\",\"strongestOpposingArguments\":[\"opposing argument 1\"],\"contradictionPoints\":[\"contradiction point 1\"],\"evidenceMentions\":[\"evidence mention 1\"],\"confidence\":\"medium\",\"limitations\":[\"limitation 1\"]}.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.falsification.json.v1",
    requiredFields: [
      "subQuestionId",
      "answer",
      "strongestOpposingArguments",
      "contradictionPoints",
      "evidenceMentions",
      "confidence",
      "limitations",
    ],
  }),
});

export const finalSynthesisPrompt = buildPrompt({
  promptId: "deep-research.final-synthesis",
  promptVersion: "v1.1.0",
  phase: "final_synthesis",
  promptText: [
    "You are an external researcher. Synthesize the persisted positive and falsification records into one final report.",
    "Return exactly one JSON object only.",
    "Do not wrap it in markdown.",
    "Do not include contractId or format.",
    "The JSON root must contain exactly these fields: executiveConclusion, confidence, positiveReasons, strongestOpposingArguments, conflictMatrix, evidenceGaps, reverseConditions, followUpSignals, limitations.",
    "confidence must be exactly one of: \"low\", \"medium\", \"high\".",
    "Do not output numeric confidence.",
    "Do not output confidence as 0.8, 80, \"80%\", or \"high confidence\".",
    "Every conflictMatrix row must include subQuestionId, positiveClaimSummary, falsificationSummary, conflictLevel, evidenceGap, needsHumanReview.",
    "Use this JSON shape: {\"executiveConclusion\":\"final conclusion\",\"confidence\":\"medium\",\"positiveReasons\":[\"reason 1\"],\"strongestOpposingArguments\":[\"argument 1\"],\"conflictMatrix\":[{\"subQuestionId\":\"database subQuestionId\",\"positiveClaimSummary\":\"summary\",\"falsificationSummary\":\"summary\",\"conflictLevel\":\"medium\",\"evidenceGap\":\"gap\",\"needsHumanReview\":true}],\"evidenceGaps\":[\"gap 1\"],\"reverseConditions\":[\"condition 1\"],\"followUpSignals\":[\"signal 1\"],\"limitations\":[\"limitation 1\"]}.",
    "Do not output next steps, action plans, browser commands, selectors, coordinates, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.final-synthesis.json.v1",
    requiredFields: [
      "executiveConclusion",
      "confidence",
      "positiveReasons",
      "strongestOpposingArguments",
      "conflictMatrix",
      "evidenceGaps",
      "reverseConditions",
      "followUpSignals",
      "limitations",
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

export const renderDeepResearchPositivePrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  subQuestion: DeepResearchSubQuestion;
}): string =>
  buildPromptDocument([
    positiveAnalysisPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    input.analysisGoal ? `Analysis goal:\n${input.analysisGoal}` : null,
    `Response language: ${input.language}`,
    `Sub-question JSON:\n${JSON.stringify(input.subQuestion, null, 2)}`,
    `Expected output contract:\n${buildContractSection(positiveAnalysisPrompt.expectedOutputContract)}`,
  ]);

export const renderDeepResearchFalsificationPrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  subQuestion: DeepResearchSubQuestion;
  positiveAnswer: unknown;
}): string =>
  buildPromptDocument([
    falsificationPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    input.analysisGoal ? `Analysis goal:\n${input.analysisGoal}` : null,
    `Response language: ${input.language}`,
    `Sub-question JSON:\n${JSON.stringify(input.subQuestion, null, 2)}`,
    `Positive answer JSON:\n${JSON.stringify(input.positiveAnswer, null, 2)}`,
    `Expected output contract:\n${buildContractSection(falsificationPrompt.expectedOutputContract)}`,
  ]);

export const renderDeepResearchFinalSynthesisPrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  finalPackage: DeepResearchFinalPackage;
}): string =>
  buildPromptDocument([
    finalSynthesisPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    input.analysisGoal ? `Analysis goal:\n${input.analysisGoal}` : null,
    `Response language: ${input.language}`,
    `Persisted research package JSON:\n${JSON.stringify(input.finalPackage, null, 2)}`,
    `Expected output contract:\n${buildContractSection(finalSynthesisPrompt.expectedOutputContract)}`,
  ]);
