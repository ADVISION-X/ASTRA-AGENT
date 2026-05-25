import type {
  DeepResearchStructuredIndex,
} from "./deep-research-analysis.final-package.js";
import type {
  DeepResearchFullCaseFile,
} from "./deep-research-analysis.full-case-file-schema.js";
import type {
  DeepResearchPrompt,
  DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

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

const buildPromptDocument = (sections: readonly (string | null | undefined)[]): string =>
  sections
    .filter((section): section is string => typeof section === "string" && section.trim().length > 0)
    .join("\n\n");

const buildContractSection = (contract: DeepResearchPromptOutputContract): string =>
  JSON.stringify(contract, null, 2);

const buildUnavailableAnalysisGoalSection = (analysisGoal: string | null): string =>
  `Analysis goal:\n${analysisGoal ?? "UNAVAILABLE"}`;

export const finalAdjudicationPrompt: DeepResearchPrompt = {
  promptId: "deep-research.final-adjudication",
  promptVersion: "v1.1.0",
  phase: "final_adjudication",
  promptText: [
    "You are the Final Adjudicator for a Deep Research job.",
    "",
    "You are not a summarizer.",
    "You are the final judge.",
    "",
    "Your task is to directly answer the user's original question by adjudicating the structured package and the full case file.",
    "",
    "The structured package is for navigation.",
    "The full case file is the complete source of truth.",
    "If structured fields and raw responses differ, use the raw responses as primary evidence.",
    "Do not assume missing structured fields mean missing analysis.",
    "Do not ignore raw responses that failed parsing.",
    "The runtime has no authority to omit or down-rank content.",
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
    "Do not output browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, filePath, or any follow-up action field.",
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
    "limitations,",
    "sourceNotes.",
    "",
    "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
    "If a preferred field is unavailable, omit it instead of inventing evidence.",
    "Use the persisted package sourceNotes when available; do not invent URLs or new sources.",
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
    '  "limitations": ["limitation 1"],',
    '  "sourceNotes": [{"sourceNoteId":"source-note-001","label":"Source Note 1","note":"source description from the persisted package","sourceType":"analysis_evidence_mention","subQuestionIds":["sub-question id"],"url":null}]',
    "}",
  ].join("\n"),
  expectedOutputContract: buildOutputContract({
    contractId: "deep-research.final-adjudication.json.v1.1",
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
      "sourceNotes",
    ],
  }),
};

export const renderDeepResearchFinalAdjudicationPrompt = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
  fullCaseFileMarkdown?: string | null;
}): string => buildPromptDocument([
  finalAdjudicationPrompt.promptText,
  `User question:\n${input.userQuestion}`,
  buildUnavailableAnalysisGoalSection(input.analysisGoal),
  `Response language:\n${input.language}`,
  `Decision package JSON:\n${JSON.stringify(input.structuredIndex, null, 2)}`,
  input.fullCaseFile
    ? `Full case file metadata JSON:\n${JSON.stringify({
      caseFileVersion: input.fullCaseFile.caseFileVersion,
      job: input.fullCaseFile.job,
      coverage: input.fullCaseFile.coverage,
      failedButRawAvailableInteractionCount: input.fullCaseFile.failedButRawAvailableInteractions.length,
    }, null, 2)}`
    : null,
  input.fullCaseFileMarkdown && input.fullCaseFileMarkdown.trim().length > 0
    ? `Full case file markdown:\n${input.fullCaseFileMarkdown}`
    : null,
  `Expected output contract:\n${buildContractSection(finalAdjudicationPrompt.expectedOutputContract)}`,
]);