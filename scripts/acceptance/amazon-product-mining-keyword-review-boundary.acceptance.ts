import assert from "node:assert/strict";

import {
  parseKeywordReviewResponse,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.js";
import { buildKeywordFullPackagePrompt } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-full-package.js";
import { AmazonMiningSchemas } from "../../src/plugins/amazon-product-mining/index.js";

const prompt = buildKeywordFullPackagePrompt({
  keyword: {
    keywordId: "keyword-1",
    taskId: "task-1",
    keyword: "desk organizer",
    source: "ai_generated",
    status: "completed",
    aiRunId: "run-1",
    reason: "acceptance fixture",
    keywordHistoryRelation: "new_keyword",
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
  artifacts: {
    packageRootPath: "/tmp/keyword-keyword-1-full-evidence-package",
    inlineNavigationPath: "/tmp/keyword-keyword-1-full-evidence-package/07-ai-handoff/inline-evidence-navigation.json",
    packageIntegrityReportPath: "/tmp/keyword-keyword-1-full-evidence-package/05-completeness/package-integrity-report.json",
  },
});

for (const requiredToken of [
  "You must read the uploaded keyword full evidence package archive before deciding.",
  "The archive is a transport wrapper over the full package directory, not a second truth source.",
  "The inline navigation file is only a reading map",
  "keyword product pool candidate screening, not final product selection",
  "pre-human-validation screening gate",
  "Only AI-accepted keyword product pools enter human product finding, product comparison, and later calculation work.",
  "PASS is conservative",
  "REJECT is mandatory when the readable full package gives enough evidence that the keyword product pool is not worth human validation.",
  "Do not choose WATCH to be polite when the evidence is sufficient for REJECT.",
  "Use INSUFFICIENT_DATA only when the package is unreadable, core search/detail/review evidence is missing, or dataConfidence is insufficient.",
  "PASS | WATCH | REJECT | INSUFFICIENT_DATA",
  "enter_next_validation | mine_related_keywords | reject | rerun_or_collect_more_data",
]) {
  assert.equal(prompt.includes(requiredToken), true, `Prompt must include ${requiredToken}`);
}

const parsed = parseKeywordReviewResponse(`\`\`\`json
{
  "decision": "WATCH",
  "demandSignal": "medium",
  "reviewHealth": "weak",
  "priceCeiling": "medium",
  "competitionOpenness": "medium",
  "improvementOpportunity": "strong",
  "dataConfidence": "medium",
  "evidenceRefs": ["evidence-index"],
  "missingEvidence": [],
  "riskPoints": ["competition pressure"],
  "humanNextStep": "mine_related_keywords"
}
\`\`\``);
assert.equal(parsed?.decision, "WATCH");
assert.equal(parseKeywordReviewResponse("not-json"), null);

const rejected = parseKeywordReviewResponse(JSON.stringify({
  decision: "REJECT",
  demandSignal: "weak",
  reviewHealth: "weak",
  priceCeiling: "weak",
  competitionOpenness: "weak",
  improvementOpportunity: "weak",
  dataConfidence: "medium",
  evidenceRefs: ["05-completeness/data-completeness-report.json", "03-reviews/reviews-summary.json"],
  missingEvidence: [],
  riskPoints: ["full package shows a non-workable keyword pool for human validation"],
  humanNextStep: "reject",
}));
assert.equal(rejected?.decision, "REJECT");
assert.equal(rejected?.humanNextStep, "reject");

assert.throws(() => AmazonMiningSchemas.AmazonKeywordOpportunityVerdictSchema.parse({
  decision: "BUY_NOW",
  demandSignal: "strong",
  reviewHealth: "medium",
  priceCeiling: "medium",
  competitionOpenness: "medium",
  improvementOpportunity: "strong",
  dataConfidence: "medium",
  evidenceRefs: [],
  missingEvidence: [],
  riskPoints: [],
  humanNextStep: "enter_next_validation",
}));

assert.throws(() => AmazonMiningSchemas.AmazonKeywordOpportunityVerdictSchema.parse({
  decision: "PASS",
  demandSignal: "strong",
  reviewHealth: "medium",
  priceCeiling: "medium",
  competitionOpenness: "medium",
  improvementOpportunity: "strong",
  dataConfidence: "medium",
  evidenceRefs: [],
  missingEvidence: [],
  riskPoints: [],
  humanNextStep: "procure",
}));

assert.equal("AmazonKeywordOpportunityManualIngestSchema" in AmazonMiningSchemas, false);
assert.throws(() => AmazonMiningSchemas.AmazonKeywordOpportunityReviewRecordSchema.parse({
  reviewId: "review-1",
  taskId: "task-1",
  keywordId: "keyword-1",
  keyword: "desk organizer",
  status: "manual_required",
  decision: null,
  demandSignal: null,
  reviewHealth: null,
  priceCeiling: null,
  competitionOpenness: null,
  improvementOpportunity: null,
  dataConfidence: null,
  evidenceRefs: [],
  missingEvidence: [],
  riskPoints: [],
  humanNextStep: null,
  aiPromptText: prompt,
  aiRawResponse: "",
  aiResponseRef: null,
  packageRef: null,
  keywordPackageSliceRef: null,
  failureReason: "keyword_review_provider_not_ready",
  createdAt: new Date().toISOString(),
  updatedAt: null,
}));

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-review-boundary\n");
