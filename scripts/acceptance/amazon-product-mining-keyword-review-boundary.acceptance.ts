import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ingestManualKeywordOpportunityReview } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.js";
import {
  parseKeywordReviewResponse,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.js";
import { buildKeywordFullPackagePrompt } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-full-package.js";
import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";
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

assert.throws(() => AmazonMiningSchemas.AmazonKeywordOpportunityManualIngestSchema.parse({
  reviewId: "review-1",
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

assert.throws(() => AmazonMiningSchemas.AmazonKeywordOpportunityManualIngestSchema.parse({
  reviewId: "review-1",
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

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-keyword-review-boundary-"));
const storage = createAmazonMiningStorage(dataDir);

try {
  const responsePath = path.join(dataDir, "keyword-opportunity-review-response.json");
  writeFileSync(responsePath, "{}\n", "utf8");
  const now = new Date().toISOString();
  storage.saveKeywordOpportunityReview({
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
    aiResponseRef: responsePath,
    packageRef: path.join(dataDir, "package.json"),
    keywordPackageSliceRef: path.join(dataDir, "slice.json"),
    failureReason: "keyword_review_manual_required",
    createdAt: now,
    updatedAt: null,
  });

  const ingested = ingestManualKeywordOpportunityReview({
    dataDir,
    storage,
    rawInput: {
      reviewId: "review-1",
      decision: "PASS",
      demandSignal: "strong",
      reviewHealth: "medium",
      priceCeiling: "medium",
      competitionOpenness: "medium",
      improvementOpportunity: "strong",
      dataConfidence: "medium",
      evidenceRefs: ["keyword-search-evidence"],
      missingEvidence: [],
      riskPoints: [],
      humanNextStep: "enter_next_validation",
      aiRawResponse: JSON.stringify({ source: "manual" }),
    },
  });

  assert.equal(ingested.status, "completed");
  assert.equal(ingested.decision, "PASS");
  assert.equal(ingested.humanNextStep, "enter_next_validation");
  assert.equal(Boolean(ingested.aiResponseRef && existsSync(ingested.aiResponseRef)), true);

  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-review-boundary\n");
} finally {
  storage.close();
  rmSync(dataDir, { recursive: true, force: true });
}
