import { stableJsonHash } from "../../lib/storage/hash.js";

import {
  type DeepResearchPrompt,
  type DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
export {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  renderDecompositionPrompt,
} from "./deep-research-analysis.decomposition-prompt.js";
import type {
  DeepResearchInput,
  DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import type {
  DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";

const FORBIDDEN_CONTROL_FIELDS = [
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
  promptId: "deep-research.decomposition",
  promptVersion: "v1.0.0",
  phase: "decomposition",
  promptText: [
    "You are an external researcher. Decompose the user question into a bounded set of sub-questions.",
    "Return one JSON object only.",
    "The JSON object must contain mainQuestion and subQuestions.",
    "subQuestions must contain at least two items and each item must include id, title, questionText, purpose, scope, expectedAnswerShape.",
    "Do not output runtime control fields, browser commands, selectors, coordinates, workflows, database commands, or file paths.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.decomposition.json.v1",
    requiredFields: ["mainQuestion", "subQuestions"],
  }),
});

export const positiveAnalysisPrompt = buildPrompt({
  promptId: "deep-research.positive-analysis",
  promptVersion: "v1.0.0",
  phase: "positive",
  promptText: [
    "You are an external researcher. Produce the strongest positive analysis for one sub-question.",
    "Return one JSON object only.",
    "The JSON object must include subQuestionId, answer, keyClaims, supportingReasons, assumptions, evidenceMentions, confidence, limitations.",
    "Focus on supportive reasoning only. Do not output system control fields.",
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
  promptVersion: "v1.0.0",
  phase: "falsification",
  promptText: [
    "You are an external researcher. Produce the strongest falsification and opposing case for one sub-question.",
    "Return one JSON object only.",
    "The JSON object must include subQuestionId, answer, strongestOpposingArguments, contradictionPoints, evidenceMentions, confidence, limitations.",
    "Do not output control fields or workflow instructions.",
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
  promptVersion: "v1.0.0",
  phase: "final_synthesis",
  promptText: [
    "You are an external researcher. Synthesize the persisted positive and falsification records into one final report.",
    "Return one JSON object only.",
    "The JSON object must include executiveConclusion, confidence, positiveReasons, strongestOpposingArguments, conflictMatrix, evidenceGaps, reverseConditions, followUpSignals, limitations.",
    "Every conflictMatrix row must include subQuestionId, positiveClaimSummary, falsificationSummary, conflictLevel, evidenceGap, needsHumanReview.",
    "Do not output next steps, action plans, browser commands, selectors, or coordinates.",
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

export const DeepResearchPromptCatalog = {
  decomposition: decompositionPrompt,
  positive: positiveAnalysisPrompt,
  falsification: falsificationPrompt,
  finalSynthesis: finalSynthesisPrompt,
} as const;

export const buildDeepResearchPromptHash = (prompt: DeepResearchPrompt): string =>
  stableJsonHash({
    promptId: prompt.promptId,
    promptVersion: prompt.promptVersion,
    phase: prompt.phase,
    promptText: prompt.promptText,
    expectedOutputContract: prompt.expectedOutputContract,
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
    decompositionPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    input.analysisGoal ? `Analysis goal:\n${input.analysisGoal}` : null,
    `Response language: ${input.language}`,
    `Maximum sub-questions: ${input.maxSubQuestions}`,
    `Expected output contract:\n${buildContractSection(decompositionPrompt.expectedOutputContract)}`,
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
