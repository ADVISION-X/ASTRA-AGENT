import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES,
  detectCurrentEventMissingInfo,
  detectFinalAdjudicationLeakage,
  parseDecompositionResponse,
  parseDeepResearchFinalAdjudicationResponse,
  parseDeepResearchSubQuestionAnalysisResponse,
  renderDecompositionPrompt,
  runDeepResearchDecompositionPhase,
  scoreDecompositionQuality,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { repoRoot } from "../audit/shared/paths.js";

const readFixture = (name: string): string =>
  readFileSync(
    resolve(repoRoot, "scripts/acceptance/fixtures/deep-research-decomposition", name),
    "utf8",
  );

const validFixtureText = readFixture("valid-stock-response.json");
const validIranFixtureText = readFixture("valid-iran-war-response.json");
const invalidOldContractText = readFixture("invalid-old-decomposition-response.json");
const invalidExtraRootFieldsText = readFixture("invalid-extra-root-fields-response.json");
const invalidFinalAdjudicationLeakageText = readFixture("invalid-final-synthesis-leakage-response.json");

const assertStatus = (actual: string, expected: string): void => {
  assert.equal(actual, expected);
};

const parsedSuccessStatuses = new Set([
  "parsed",
  "parsed_with_trailing_noise",
  "parsed_json",
  "parsed_json_from_fence",
  "parsed_json_from_balanced_object",
  "parsed_text_fallback",
]);

const isParsedSuccessStatus = (status: string): boolean => parsedSuccessStatuses.has(status);

const assertParsedStatus = (actual: string): void => {
  assert.equal(isParsedSuccessStatus(actual), true, `Expected a parsed success status, received ${actual}.`);
};

const rendered = renderDecompositionPrompt({
  userQuestion: "某科技股近期上涨是否由基本面支撑？",
  maxSubQuestions: 6,
  language: "zh-CN",
  questionTypeHint: "stock",
});
assert.match(rendered, /某科技股近期上涨是否由基本面支撑/u);
assert.match(rendered, /6/u);
assert.match(rendered, /Do not include contractId/u);
assert.match(rendered, /Do not include format/u);
assert.match(rendered, /decisionWeight must be one of/u);
assert.match(rendered, /isReadyForIndependentAnalysis/u);
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId, "deep-research.decomposition");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion, "v2.0.0");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase, "decompose");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId, "deep-research.decomposition-output.v2.0");

const validParse = parseDecompositionResponse({
  rawText: validFixtureText,
  maxSubQuestions: 6,
});
assertParsedStatus(validParse.parseStatus);
const validParsed = validParse.parsed;
if (!isParsedSuccessStatus(validParse.parseStatus) || !validParsed) {
  throw new Error("valid fixture did not parse");
}
const firstSubQuestion = validParsed.subQuestions[0];
const secondSubQuestion = validParsed.subQuestions[1];
if (!firstSubQuestion || !secondSubQuestion) {
  throw new Error("valid fixture must contain at least two sub-questions");
}
assert.ok(validParsed.subQuestions.every((subQuestion) => subQuestion.requiredEvidence.length >= 2));
assert.ok(validParsed.subQuestions.every((subQuestion) => subQuestion.whyItMatters.trim().length > 0));
assert.ok(validParsed.subQuestions.every((subQuestion) => subQuestion.analysisFocus.trim().length > 0));
assert.ok(validParsed.subQuestions.every((subQuestion) => subQuestion.omissionRisk.trim().length > 0));

const invalidJson = parseDecompositionResponse({
  rawText: "{ invalid",
  maxSubQuestions: 6,
});
assertStatus(invalidJson.parseStatus, "failed");

const missingField = parseDecompositionResponse({
  rawText: JSON.stringify({ mainQuestion: "x", subQuestions: [] }),
  maxSubQuestions: 6,
});
assertStatus(missingField.parseStatus, "failed");

const oldContract = parseDecompositionResponse({
  rawText: invalidOldContractText,
  maxSubQuestions: 12,
});
assertStatus(oldContract.parseStatus, "failed");
if (oldContract.parseStatus === "parsed") {
  throw new Error("old contract must fail");
}
assert.match(oldContract.reason, /invalid_decomposition_contract/u);

const extraRootFields = parseDecompositionResponse({
  rawText: invalidExtraRootFieldsText,
  maxSubQuestions: 12,
});
assertStatus(extraRootFields.parseStatus, "failed");
if (extraRootFields.parseStatus === "parsed") {
  throw new Error("extra root fields must fail");
}
assert.match(extraRootFields.reason, /schema_extra_fields_not_allowed/u);

const emptySubQuestions = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParsed,
    subQuestions: [],
  }),
  maxSubQuestions: 6,
});
assertStatus(emptySubQuestions.parseStatus, "failed");

const duplicateSubQuestions = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParsed,
    subQuestions: [
      firstSubQuestion,
      {
        ...secondSubQuestion,
        questionText: firstSubQuestion.questionText,
      },
    ],
  }),
  maxSubQuestions: 6,
});
assertStatus(duplicateSubQuestions.parseStatus, "partial_review_required");

const qualitySelfCheckFalse = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParsed,
    qualitySelfCheck: {
      ...validParsed.qualitySelfCheck,
      isReadyForIndependentAnalysis: false,
    },
  }),
  maxSubQuestions: 6,
});
assertStatus(qualitySelfCheckFalse.parseStatus, "partial_review_required");

const quality = scoreDecompositionQuality(validParsed);
assert.equal(quality.status, "passed");
assert.ok(quality.score >= quality.passScore);

const validIran = parseDecompositionResponse({
  rawText: validIranFixtureText,
  maxSubQuestions: 12,
});
assertParsedStatus(validIran.parseStatus);
const validIranParsed = validIran.parsed;
if (!isParsedSuccessStatus(validIran.parseStatus) || !validIranParsed) {
  throw new Error("valid iran fixture did not parse");
}
assert.equal(validIranParsed.questionType, "event");
assert.ok(validIranParsed.subQuestions.length >= 8);
assert.ok(validIranParsed.subQuestions.length <= 12);
assert.equal(detectCurrentEventMissingInfo(validIranParsed), false);
assert.ok(validIranParsed.subQuestions.every((subQuestion) => subQuestion.requiredEvidence.length >= 2));
assert.ok(validIranParsed.subQuestions.every((subQuestion) => subQuestion.whyItMatters.trim().length > 0));
assert.ok(validIranParsed.subQuestions.every((subQuestion) => subQuestion.analysisFocus.trim().length > 0));
assert.ok(validIranParsed.subQuestions.every((subQuestion) => subQuestion.omissionRisk.trim().length > 0));
assert.ok(!validIranParsed.subQuestions.some((subQuestion) => detectFinalAdjudicationLeakage(subQuestion.questionText)));
const iranQuality = scoreDecompositionQuality(validIranParsed);
assert.equal(iranQuality.status, "passed");

const leakageParse = parseDecompositionResponse({
  rawText: invalidFinalAdjudicationLeakageText,
  maxSubQuestions: 12,
});
assertParsedStatus(leakageParse.parseStatus);
const leakageParsed = leakageParse.parsed;
if (!isParsedSuccessStatus(leakageParse.parseStatus) || !leakageParsed) {
  throw new Error("leakage fixture must be schema-valid before quality scoring");
}
const leakageQuality = scoreDecompositionQuality(leakageParsed);
assert.equal(leakageQuality.status, "failed");
assert.ok(leakageParsed.subQuestions.some((subQuestion) => detectFinalAdjudicationLeakage(subQuestion.questionText)));

assert.ok(DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES.length >= 10);
for (const fixture of DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES) {
  assert.equal(fixture.mustHaveFalsificationFocus, true);
  assert.equal(fixture.mustHaveRequiredEvidence, true);
  assert.ok(fixture.minQualityScore >= 14);
  assert.ok(fixture.mustCoverDimensions.length > 0);
}

const validAnalysisResponse = {
  subQuestionId: "deep_research_sub_question_acceptance",
  answer: "Independent analysis answer.",
  coreFinding: "The local finding supports a conditional positive conclusion.",
  keyClaims: ["claim"],
  supportingReasons: ["reason"],
  counterConditions: ["condition"],
  failureCases: ["failure case"],
  evidenceMentions: ["evidence"],
  evidenceQuality: "moderate",
  assumptions: ["assumption"],
  uncertainties: ["uncertainty"],
  impactOnFinalAdjudication: "Support a conditional yes, not a clean yes.",
  confidence: "medium",
  limitations: ["limitation"],
};
const enumAnalysis = parseDeepResearchSubQuestionAnalysisResponse(JSON.stringify(validAnalysisResponse));
assertParsedStatus(enumAnalysis.parseStatus);
const numericAnalysis = parseDeepResearchSubQuestionAnalysisResponse(JSON.stringify({
  ...validAnalysisResponse,
  confidence: 0.82,
}));
assertParsedStatus(numericAnalysis.parseStatus);
const numericAnalysisParsed = numericAnalysis.parsed;
if (isParsedSuccessStatus(numericAnalysis.parseStatus) && numericAnalysisParsed) {
  assert.equal(numericAnalysisParsed.confidence, "high");
}
const proseWrappedAnalysis = parseDeepResearchSubQuestionAnalysisResponse(`Analysis follows:\n${JSON.stringify({
  ...validAnalysisResponse,
  confidence: "80%",
  extraField: "still allowed",
})}\nEnd.`);
assertParsedStatus(proseWrappedAnalysis.parseStatus);

const validFinalResponse = {
  directAnswer: "The answer is conditionally yes.",
  finalVerdict: "conditional",
  confidence: "medium",
  rankedConclusions: [{
    rank: 1,
    conclusion: "Core evidence supports a conditional yes.",
    whyItMatters: "This is the strongest conclusion.",
    strength: "strong" as const,
    appliesTo: ["base case"],
    doesNotApplyTo: ["stress case"],
    reverseCondition: "A severe negative signal would reverse this conclusion.",
  }],
  strongConclusions: ["Core evidence supports a conditional yes."],
  conditionalConclusions: ["The conclusion weakens if the main assumption breaks."],
  weakOrRejectedClaims: ["A clean yes is not supported."],
  decisiveReasons: ["The strongest sub-question evidence points in one direction."],
  evidenceGaps: ["Need fresher field data."],
  reverseConditions: ["A severe negative signal would reverse the judgment."],
  applicability: ["base case"],
  nonApplicability: ["stress case"],
  followUpSignals: ["watch the next earnings update"],
  multiStageValueAdded: ["The multi-stage flow separated decomposition, analysis, and adjudication."],
  limitations: ["This is a fixture."],
};
const enumFinal = parseDeepResearchFinalAdjudicationResponse(JSON.stringify(validFinalResponse));
assertParsedStatus(enumFinal.parseStatus);
const numericFinal = parseDeepResearchFinalAdjudicationResponse(JSON.stringify({
  ...validFinalResponse,
  confidence: 0.82,
}));
assertParsedStatus(numericFinal.parseStatus);
const numericFinalParsed = numericFinal.parsed;
if (isParsedSuccessStatus(numericFinal.parseStatus) && numericFinalParsed) {
  assert.equal(numericFinalParsed.confidence, "high");
}
const rawCaseFileFinal = parseDeepResearchFinalAdjudicationResponse(
  JSON.stringify({
    directAnswer: "Raw case material supports a conditional decision.",
    finalVerdict: "conditional_decision",
    confidence: "80%",
  }),
  {
    decisiveReasons: ["case-file reason"],
    strongestOpposingArguments: ["case-file opposing argument"],
    evidenceGaps: ["case-file gap"],
    reverseConditions: ["case-file reverse condition"],
    followUpSignals: ["case-file follow-up"],
    limitations: ["case-file limitation"],
  },
);
assertParsedStatus(rawCaseFileFinal.parseStatus);
const rawCaseFileFinalParsed = rawCaseFileFinal.parsed;
if (isParsedSuccessStatus(rawCaseFileFinal.parseStatus) && rawCaseFileFinalParsed) {
  assert.equal(rawCaseFileFinalParsed.confidence, "high");
  assert.ok(rawCaseFileFinalParsed.directAnswer.includes("Raw case material"));
}

const flowResult = await runDeepResearchDecompositionPhase({
  jobId: "acceptance-job",
  userQuestion: "某科技股近期上涨是否由基本面支撑？",
  maxSubQuestions: 6,
  language: "zh-CN",
  questionTypeHint: "stock",
  providerKind: "gemini-api",
  sendPromptPackage: async (promptPackage) => ({
    status: "completed",
    rawOutputRef: "artifact://acceptance/raw-output",
    rawOutputHash: promptPackage.promptHash,
    normalizedText: validFixtureText,
    providerProofJson: JSON.stringify({ providerKind: promptPackage.providerKind }),
    errorReason: null,
  }),
});
assertStatus(flowResult.status, "parsed");
assert.ok(flowResult.interaction.promptHash.startsWith("sha256:"));
assert.ok(flowResult.interaction.rawResponseHash.startsWith("sha256:"));

process.stdout.write("[ACCEPTANCE][deep-research-decomposition-prompt] PASS\n");
