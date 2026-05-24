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
  "nextAction",
  "actionPlan",
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

export const positiveAnalysisPrompt = buildPrompt({
  promptId: "deep-research.positive-analysis",
  promptVersion: "v1.2.0",
  phase: "positive",
  promptText: [
    "You are an external researcher. Produce the strongest positive analysis for one sub-question.",
    "Return one JSON object when possible.",
    "Minor wrapper prose or markdown fences are acceptable.",
    "Prioritize analytical content over perfect formatting.",
    "Do not include contractId or format.",
    "Do not include browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
    "Preferred fields: subQuestionId, answer, keyClaims, supportingReasons, assumptions, evidenceMentions, confidence, limitations.",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "Extra explanatory fields are acceptable.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "Recommended JSON shape: {\"subQuestionId\":\"the database subQuestionId from input\",\"answer\":\"positive analysis answer\",\"keyClaims\":[\"claim 1\"],\"supportingReasons\":[\"reason 1\"],\"assumptions\":[\"assumption 1\"],\"evidenceMentions\":[\"evidence mention 1\"],\"confidence\":\"medium\",\"limitations\":[\"limitation 1\"]}.",
    "Focus on supportive reasoning only.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.positive-analysis.json.v1.2",
    requiredFields: [
      "subQuestionId",
      "answer",
      "confidence",
    ],
  }),
});

export const falsificationPrompt = buildPrompt({
  promptId: "deep-research.falsification",
  promptVersion: "v1.2.0",
  phase: "falsification",
  promptText: [
    "You are an external researcher. Produce the strongest falsification and opposing case for one sub-question.",
    "Return one JSON object when possible.",
    "Minor wrapper prose or markdown fences are acceptable.",
    "Prioritize analytical content over perfect formatting.",
    "Do not include contractId or format.",
    "Do not include browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
    "Preferred fields: subQuestionId, answer, strongestOpposingArguments, contradictionPoints, evidenceMentions, confidence, limitations.",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "Extra explanatory fields are acceptable.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "Recommended JSON shape: {\"subQuestionId\":\"the database subQuestionId from input\",\"answer\":\"falsification answer\",\"strongestOpposingArguments\":[\"opposing argument 1\"],\"contradictionPoints\":[\"contradiction point 1\"],\"evidenceMentions\":[\"evidence mention 1\"],\"confidence\":\"medium\",\"limitations\":[\"limitation 1\"]}.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.falsification.json.v1.2",
    requiredFields: [
      "subQuestionId",
      "answer",
      "confidence",
    ],
  }),
});

export const finalSynthesisPrompt = buildPrompt({
  promptId: "deep-research.final-synthesis",
  promptVersion: "v1.2.0",
  phase: "final_synthesis",
  promptText: [
    "You are an external researcher. Synthesize the persisted positive and falsification records into one final report.",
    "Return one JSON object when possible.",
    "Minor wrapper prose or markdown fences are acceptable.",
    "Prioritize analytical content over perfect formatting.",
    "Do not include contractId or format.",
    "Preferred fields: executiveConclusion, confidence, positiveReasons, strongestOpposingArguments, evidenceGaps, reverseConditions, followUpSignals, limitations, and optionally conflictMatrix.",
    "The persisted research package already contains a system-built conflictMatrix and missingSubQuestionIds; you may omit conflictMatrix if your narrative does not need to rewrite it.",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "Extra explanatory fields are acceptable.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "Recommended JSON shape: {\"executiveConclusion\":\"final conclusion\",\"confidence\":\"medium\",\"positiveReasons\":[\"reason 1\"],\"strongestOpposingArguments\":[\"argument 1\"],\"evidenceGaps\":[\"gap 1\"],\"reverseConditions\":[\"condition 1\"],\"followUpSignals\":[\"signal 1\"],\"limitations\":[\"limitation 1\"]}.",
    "Do not output next steps, action plans, browser commands, selectors, coordinates, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.final-synthesis.json.v1.2",
    requiredFields: [
      "executiveConclusion",
      "confidence",
    ],
  }),
});

export const finalAdjudicationPrompt = buildPrompt({
  promptId: "deep-research.final-adjudication",
  promptVersion: "v1.0.0",
  phase: "final_adjudication",
  promptText: [
    "You are the Final Adjudicator for a Deep Research job.",
    "",
    "You are not a summarizer.",
    "You are the final judge.",
    "",
    "Your task is to directly answer the user's original question by adjudicating the persisted decomposition and independent sub-question analyses.",
    "",
    "You must:",
    "1. directly answer the original user question,",
    "2. rank the most important conclusions when ranking is useful,",
    "3. distinguish strong conclusions, conditional conclusions, weak conclusions, and rejected claims,",
    "4. explain which findings matter most and why,",
    "5. identify what would reverse the final judgment,",
    "6. identify evidence gaps,",
    "7. state how much value the multi-stage research added compared with a one-shot answer.",
    "",
    "Do not output browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, filePath, or nextAction.",
    "Do not include contractId.",
    "Do not include format.",
    "Do not provide investment, legal, medical, tax, military, or operational action instructions.",
    "",
    "Prioritize analytical content over perfect formatting.",
    "Return one JSON object when possible.",
    "Minor wrapper prose or markdown fences are acceptable.",
    "",
    "Preferred fields:",
    "directAnswer,",
    "finalVerdict,",
    "confidence,",
    "rankedConclusions,",
    "strongConclusions,",
    "conditionalConclusions,",
    "weakOrRejectedClaims,",
    "decisiveReasons,",
    "evidenceGaps,",
    "reverseConditions,",
    "applicability,",
    "nonApplicability,",
    "followUpSignals,",
    "multiStageValueAdded,",
    "limitations.",
    "",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "",
    "finalVerdict should be a concise label that fits the user's question.",
    "Examples:",
    "bullish | bearish | neutral | uncertain",
    "yes | no | conditional",
    "high_priority | medium_priority | low_priority",
    "do_now | wait | avoid | conditional",
    "or a short natural-language label if enums do not fit.",
    "",
    "For rankedConclusions, each item should include:",
    "rank,",
    "conclusion,",
    "whyItMatters,",
    "strength,",
    "appliesTo,",
    "doesNotApplyTo,",
    "reverseCondition.",
    "",
    "strength must be one of:",
    "strong,",
    "moderate,",
    "weak,",
    "conditional.",
    "",
    "You must not end with a vague \"it depends\" conclusion.",
    "If the correct answer is conditional, specify the exact conditions and ranking.",
    "",
    "Recommended JSON shape:",
    "",
    "{",
    '  "directAnswer": "direct answer to the original user question",',
    '  "finalVerdict": "concise verdict label",',
    '  "confidence": "medium",',
    '  "rankedConclusions": [',
    "    {",
    '      "rank": 1,',
    '      "conclusion": "ranked conclusion",',
    '      "whyItMatters": "why this conclusion matters",',
    '      "strength": "strong | moderate | weak | conditional",',
    '      "appliesTo": ["profile or condition"],',
    '      "doesNotApplyTo": ["profile or condition"],',
    '      "reverseCondition": "what would weaken or reverse it"',
    "    }",
    "  ],",
    '  "strongConclusions": ["strong conclusion 1"],',
    '  "conditionalConclusions": ["conditional conclusion 1"],',
    '  "weakOrRejectedClaims": ["claim that was weakened or rejected"],',
    '  "decisiveReasons": ["decisive reason 1"],',
    '  "evidenceGaps": ["gap 1"],',
    '  "reverseConditions": ["condition 1"],',
    '  "applicability": ["who this conclusion applies to"],',
    '  "nonApplicability": ["who this conclusion does not apply to"],',
    '  "followUpSignals": ["signal 1"],',
    '  "multiStageValueAdded": ["what the multi-stage process clarified beyond a one-shot answer"],',
    '  "limitations": ["limitation 1"]',
    "}",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.final-adjudication.json.v1.0",
    requiredFields: [
      "directAnswer",
      "finalVerdict",
      "rankedConclusions",
      "strongConclusions",
      "conditionalConclusions",
      "weakOrRejectedClaims",
      "decisiveReasons",
      "evidenceGaps",
      "reverseConditions",
      "multiStageValueAdded",
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

export const renderDeepResearchFinalAdjudicationPrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  finalPackage: unknown;
}): string =>
  buildPromptDocument([
    finalAdjudicationPrompt.promptText,
    `User question:\n${input.userQuestion}`,
    buildUnavailableAnalysisGoalSection(input.analysisGoal),
    `Response language:\n${input.language}`,
    `Persisted research package JSON:\n${JSON.stringify(input.finalPackage, null, 2)}`,
    `Expected output contract:\n${buildContractSection(finalAdjudicationPrompt.expectedOutputContract)}`,
  ]);
