import { stableJsonHash } from "../../lib/storage/hash.js";

import {
  type DeepResearchPrompt,
  type DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type {
  DeepResearchInput,
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
  "followUpAction",
  "executionDirective",
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

const buildUnavailableAnalysisGoalSection = (analysisGoal: string | null): string =>
  `Analysis goal:\n${analysisGoal ?? "UNAVAILABLE"}`;

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
      "exhaustivenessCheck",
      "qualitySelfCheck",
    ],
  }),
});

export const subQuestionAnalysisPrompt = buildPrompt({
  promptId: "deep-research.sub-question-analysis",
  promptVersion: "v1.0.0",
  phase: "analysis",
  promptText: [
    "You are an independent research analyst.",
    "",
    "Your task is to answer one sub-question deeply and neutrally for a later final adjudicator.",
    "",
    "Do not merely support one side.",
    "Do not merely oppose one side.",
    "Do not answer the user's main question directly unless this sub-question requires a local finding.",
    "Do not produce the final overall judgment.",
    "Do not provide investment, legal, medical, tax, military, or operational action instructions.",
    "Do not output browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
    "",
    "Prioritize analytical content over perfect formatting.",
    "Return one JSON object when possible.",
    "Minor wrapper prose or markdown fences are acceptable.",
    "Do not include contractId or format.",
    "",
    "Preferred fields:",
    "subQuestionId,",
    "answer,",
    "coreFinding,",
    "keyClaims,",
    "supportingReasons,",
    "counterConditions,",
    "failureCases,",
    "evidenceMentions,",
    "evidenceQuality,",
    "assumptions,",
    "uncertainties,",
    "impactOnFinalAdjudication,",
    "confidence,",
    "limitations.",
    "",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "",
    "evidenceQuality must be one of:",
    "strong,",
    "moderate,",
    "weak,",
    "mixed,",
    "unknown.",
    "",
    "Extra explanatory fields are acceptable.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "",
    "You must include:",
    "- the strongest reasons supporting the local finding,",
    "- the strongest conditions under which the local finding would fail,",
    "- the biggest uncertainty,",
    "- how this sub-question should affect the final adjudication,",
    "- whether the finding is generally applicable or only conditional.",
    "",
    "Recommended JSON shape:",
    "",
    "{",
    '  "subQuestionId": "the database subQuestionId from input",',
    '  "answer": "full neutral analysis answer",',
    '  "coreFinding": "the local finding for this sub-question",',
    '  "keyClaims": ["claim 1"],',
    '  "supportingReasons": ["reason 1"],',
    '  "counterConditions": ["condition that weakens or reverses this finding"],',
    '  "failureCases": ["case where this finding would not apply"],',
    '  "evidenceMentions": ["evidence mention or reasoning basis"],',
    '  "evidenceQuality": "strong | moderate | weak | mixed | unknown",',
    '  "assumptions": ["assumption 1"],',
    '  "uncertainties": ["uncertainty 1"],',
    '  "impactOnFinalAdjudication": "how this finding should influence the final answer",',
    '  "confidence": "medium",',
    '  "limitations": ["limitation 1"]',
    "}",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.sub-question-analysis.json.v1.0",
    requiredFields: [
      "subQuestionId",
      "answer",
      "coreFinding",
      "supportingReasons",
      "counterConditions",
      "failureCases",
      "evidenceQuality",
      "impactOnFinalAdjudication",
      "confidence",
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

export const renderDeepResearchSubQuestionAnalysisPrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  subQuestion: unknown;
}): string =>
  buildPromptDocument([
    subQuestionAnalysisPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    buildUnavailableAnalysisGoalSection(input.analysisGoal),
    `Response language:\n${input.language}`,
    `Sub-question JSON:\n${JSON.stringify(input.subQuestion, null, 2)}`,
    `Expected output contract:\n${buildContractSection(subQuestionAnalysisPrompt.expectedOutputContract)}`,
  ]);
