import { createHash } from "node:crypto";
import { stableJsonHash } from "../../lib/storage/hash.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.parser.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-shell.js";
import {
    buildResearchPlanFormatShell, renderFinalAdjudicationFromPromptBundle, renderHtmlReportFromPromptBundle, type DeepResearchPrompt,
    type DeepResearchPromptOutputContract
} from "./deep-research-analysis.prompt-bundle-shell.js";
import type { DeepResearchInput, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

export const buildDeepResearchTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

export const DEEP_RESEARCH_DECOMPOSITION_PROMPT = {
  promptId: "deep-research.decomposition",
  promptVersion: "v3.0.0",
  phase: "decompose",
  outputContractId: "deep-research.research-plan-output.v3.0",
  text: `You are the Deep Research Planning Specialist.

Your task is to:
1. decompose the user question into N necessary sub-questions,
2. generate a distinct promptBundle for each sub-question,
3. generate a finalAdjudicationPromptBundle,
4. generate an htmlReportPromptBundle.

You must not answer the user question.
You must not perform the research.
You must design the prompts that later AI calls should use.

Business prompt sovereignty belongs to this planning response.
The runtime will only add transport, safety, persistence, and format-shell constraints.

Do not output browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, filePath, nextAction, or actionPlan.
Return exactly one JSON object when possible.
Do not include contractId or format.

The JSON root must contain exactly these fields:
mainQuestion,
questionType,
decompositionStrategy,
missingInfo,
subQuestions,
finalAdjudicationPromptBundle,
htmlReportPromptBundle,
planIntegrityCheck.

questionType must be one of:
stock, event, policy, business, product, strategy, finance, crypto, macro, general, unknown.

Each sub-question must contain exactly these fields:
id,
title,
questionText,
whyItMatters,
decisionWeight,
scope,
omissionRisk,
promptBundle.

decisionWeight must be one of:
decisive, high, medium, low.

Each promptBundle must contain exactly these fields:
promptBundleId,
promptRole,
taskInstruction,
questionSpecificFocus,
mustUseInputs,
mustNotDo,
evidenceOrReasoningNeeds,
outputGuidance,
safetyBoundary,
languageInstruction.

promptRole must be:
- sub_question_analysis for subQuestions[].promptBundle,
- final_adjudication for finalAdjudicationPromptBundle,
- html_report_publisher for htmlReportPromptBundle.

outputGuidance must contain:
preferredFormat,
requiredContent,
supplementalContent,
forbiddenContent.

preferredFormat rules:
- For subQuestions[].promptBundle, preferredFormat must be structured_text.
- For finalAdjudicationPromptBundle, preferredFormat must be structured_text.
- For htmlReportPromptBundle, preferredFormat must be html_document.
- Do not use json_object for sub-question or final-adjudication promptBundles.
- Retrieval-only JSON belongs only in the runtime INDEX_JSON block, not in the main answer body.

Rules:
- Every sub-question must have its own promptBundle.
- Every sub-question promptBundle must be specific to that exact sub-question.
- Each subQuestion.promptBundle is the only business analysis instruction for that sub-question.
- The runtime will not write a replacement prompt later.
- Do not use a generic universal N-stage promptBundle.
- Each sub-question promptBundle.taskInstruction must be different from the other sub-question taskInstruction values.
- The finalAdjudicationPromptBundle must instruct the later AI how to adjudicate the full case file for this user question.
- The htmlReportPromptBundle must instruct the later AI how to publish the final report for this user question.
- The finalAdjudicationPromptBundle must be tailored to this user question and must not be a generic universal bundle.
- The htmlReportPromptBundle must be tailored to this user question and must not be a generic universal bundle.
- The promptBundle may ask for output structures suitable for the question, but the runtime will not add business fields later.
- Do not include system operation commands in any promptBundle.

Output JSON shape:

{
  "mainQuestion": "standardized version of the user question",
  "questionType": "stock | event | policy | business | product | strategy | finance | crypto | macro | general | unknown",
  "decompositionStrategy": "why these sub-questions and generated promptBundles are sufficient",
  "missingInfo": ["missing information that materially affects quality"],
  "subQuestions": [
    {
      "id": "Q1",
      "title": "short title",
      "questionText": "complete neutral sub-question",
      "whyItMatters": "why this question matters",
      "decisionWeight": "decisive | high | medium | low",
      "scope": "what is included and excluded",
      "omissionRisk": "what would be missed if skipped",
      "promptBundle": {
        "promptBundleId": "Q1-prompt-bundle",
        "promptRole": "sub_question_analysis",
        "taskInstruction": "question-specific task for this sub-question only",
        "questionSpecificFocus": ["specific focus item"],
        "mustUseInputs": ["user question", "this sub-question JSON"],
        "mustNotDo": ["do not answer unrelated questions"],
        "evidenceOrReasoningNeeds": ["needed evidence or reasoning"],
        "outputGuidance": {
          "preferredFormat": "structured_text",
          "requiredContent": ["content this specific answer should include"],
          "supplementalContent": [],
          "forbiddenContent": ["system operation commands"]
        },
        "safetyBoundary": ["safety boundary"],
        "languageInstruction": "answer in the requested response language"
      }
    }
  ],
  "finalAdjudicationPromptBundle": {
    "promptBundleId": "final-adjudication-prompt-bundle",
    "promptRole": "final_adjudication",
    "taskInstruction": "question-specific final adjudication task",
    "questionSpecificFocus": ["specific final decision focus"],
    "mustUseInputs": ["fullCaseFile", "all raw responses", "structured index"],
    "mustNotDo": ["do not ignore raw responses"],
    "evidenceOrReasoningNeeds": ["needed final reasoning"],
    "outputGuidance": {
      "preferredFormat": "structured_text",
      "requiredContent": ["content the final answer should include for this question"],
      "supplementalContent": [],
      "forbiddenContent": ["system operation commands"]
    },
    "safetyBoundary": ["safety boundary"],
    "languageInstruction": "answer in the requested response language"
  },
  "htmlReportPromptBundle": {
    "promptBundleId": "html-report-prompt-bundle",
    "promptRole": "html_report_publisher",
    "taskInstruction": "question-specific HTML report publishing task",
    "questionSpecificFocus": ["specific report focus"],
    "mustUseInputs": ["rawFinalAnswerText", "fullCaseFile"],
    "mustNotDo": ["do not change the final meaning"],
    "evidenceOrReasoningNeeds": ["needed reporting support"],
    "outputGuidance": {
      "preferredFormat": "html_document",
      "requiredContent": ["content the business report should include for this question"],
      "supplementalContent": [],
      "forbiddenContent": ["scripts", "external resources"]
    },
    "safetyBoundary": ["safe report boundary"],
    "languageInstruction": "write the report in the requested response language"
  },
  "planIntegrityCheck": {
    "everySubQuestionHasPromptBundle": true,
    "promptBundlesAreQuestionSpecific": true,
    "noGenericUniversalPromptBundle": true,
    "finalPromptBundleIsQuestionSpecific": true,
    "htmlPromptBundleIsQuestionSpecific": true,
    "runtimeWillOnlyAddShellConstraints": true
  }
}`,
} as const;

export const renderDecompositionPrompt = (input: {
  userQuestion: string;
  maxSubQuestions: number;
  language: "zh-CN" | "en";
  questionTypeHint?: string | null;
}): string => [
  DEEP_RESEARCH_DECOMPOSITION_PROMPT.text,
  buildResearchPlanFormatShell(),
  "Runtime note: sub-question and final-adjudication promptBundles must target structured_text answers; retrieval-only JSON belongs only in INDEX_JSON.",
  `User question:\n${input.userQuestion}`,
  `Maximum sub-questions:\n${input.maxSubQuestions}`,
  `Response language:\n${input.language}`,
  `Question type hint:\n${input.questionTypeHint ?? "general"}`,
  "Return the ResearchPlan JSON object now.",
].join("\n");

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

export const DEEP_RESEARCH_FINAL_ADJUDICATION_CONTRACT_ID =
  "deep-research.final-adjudication.shell.v2.0" as const;

export const buildFinalAdjudicationOutputContract = () => buildPromptOutputShellContract({
  contractId: DEEP_RESEARCH_FINAL_ADJUDICATION_CONTRACT_ID,
  format: "structured_text",
  requiredFields: ["rawFinalAnswerText"],
});

export const buildFinalAdjudicationShellPrompt = (): DeepResearchPrompt => ({
  promptId: "deep-research.final-adjudication",
  promptVersion: "v2.0.0",
  phase: "final_adjudication",
  promptText: "Runtime shell for AI-generated finalAdjudicationPromptBundle.",
  expectedOutputContract: buildFinalAdjudicationOutputContract(),
});

export const renderDeepResearchFinalAdjudicationPrompt = (input: {
  userQuestion?: string;
  analysisGoal?: string | null;
  language: DeepResearchInput["language"];
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
}): string => renderFinalAdjudicationFromPromptBundle({
  language: input.language,
  structuredIndex: input.structuredIndex,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  finalAdjudicationPromptBundle: input.finalAdjudicationPromptBundle,
});

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID =
  "deep-research.business-html-report-publisher" as const;
export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION = "v2.0.0" as const;
export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID =
  "deep-research.business-html-report.shell.v2.0" as const;

export const buildBusinessHtmlReportOutputContract = () => buildPromptOutputShellContract({
  contractId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID,
  format: "html_document",
  requiredFields: ["complete self-contained HTML document"],
});

export const buildBusinessHtmlReportShellPrompt = (): DeepResearchPrompt => ({
  promptId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
  promptVersion: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
  phase: "html_report",
  promptText: "Runtime shell for AI-generated htmlReportPromptBundle.",
  expectedOutputContract: buildBusinessHtmlReportOutputContract(),
});

export const renderDeepResearchBusinessHtmlReportPrompt = (input: {
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  htmlReportPromptBundle: DeepResearchPromptBundle;
  language: DeepResearchInput["language"];
}): string => renderHtmlReportFromPromptBundle({
  rawFinalAnswerText: input.finalAdjudication.rawFinalAnswerText,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.htmlReportPromptBundle,
  language: input.language,
});
