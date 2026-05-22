import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

import {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES,
  parseDecompositionResponse,
  renderDecompositionPrompt,
  runDeepResearchDecompositionPhase,
  scoreDecompositionQuality,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { repoRoot } from "../audit/shared/paths.js";

const fixturePath = resolve(
  repoRoot,
  "scripts/acceptance/fixtures/deep-research-decomposition/valid-stock-response.json",
);
const validFixtureText = readFileSync(fixturePath, "utf8");

const assertStatus = (actual: string, expected: string): void => {
  assert.equal(actual, expected);
};

const rendered = renderDecompositionPrompt({
  userQuestion: "某科技股近期上涨是否由基本面支撑？",
  maxSubQuestions: 6,
  language: "zh-CN",
  questionTypeHint: "stock",
});
assert.match(rendered, /某科技股近期上涨是否由基本面支撑/u);
assert.match(rendered, /6/u);
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId, "deep-research.decomposition");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion, "1.0.0");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase, "decompose");
assert.equal(DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId, "deep-research.decomposition-output.v1");

const validParse = parseDecompositionResponse({
  rawText: validFixtureText,
  maxSubQuestions: 6,
});
assertStatus(validParse.parseStatus, "parsed");
if (validParse.parseStatus !== "parsed") {
  throw new Error("valid fixture did not parse");
}
const firstSubQuestion = validParse.parsed.subQuestions[0];
const secondSubQuestion = validParse.parsed.subQuestions[1];
if (!firstSubQuestion || !secondSubQuestion) {
  throw new Error("valid fixture must contain at least two sub-questions");
}

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

const emptySubQuestions = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParse.parsed,
    subQuestions: [],
  }),
  maxSubQuestions: 6,
});
assertStatus(emptySubQuestions.parseStatus, "failed");

const duplicateSubQuestions = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParse.parsed,
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
assert.ok(
  duplicateSubQuestions.parseStatus === "partial_review_required"
  || duplicateSubQuestions.parseStatus === "failed",
);

const qualitySelfCheckFalse = parseDecompositionResponse({
  rawText: JSON.stringify({
    ...validParse.parsed,
    qualitySelfCheck: {
      ...validParse.parsed.qualitySelfCheck,
      coversRisks: false,
    },
  }),
  maxSubQuestions: 6,
});
assertStatus(qualitySelfCheckFalse.parseStatus, "partial_review_required");

const quality = scoreDecompositionQuality(validParse.parsed);
assert.equal(quality.status, "passed");
assert.ok(quality.score >= quality.passScore);

assert.ok(DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES.length >= 10);
for (const fixture of DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES) {
  assert.equal(fixture.mustHaveFalsificationFocus, true);
  assert.equal(fixture.mustHaveRequiredEvidence, true);
  assert.ok(fixture.minQualityScore >= 14);
  assert.ok(fixture.mustCoverDimensions.length > 0);
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
  }),
});
assertStatus(flowResult.status, "parsed");
assert.ok(flowResult.interaction.promptHash.startsWith("sha256:"));
assert.ok(flowResult.interaction.rawResponseHash.startsWith("sha256:"));

process.stdout.write("[ACCEPTANCE][deep-research-decomposition-prompt] PASS\n");
