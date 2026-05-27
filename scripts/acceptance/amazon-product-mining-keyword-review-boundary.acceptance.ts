import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ingestManualKeywordOpportunityReview } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.js";
import {
  buildKeywordReviewPrompt,
  parseKeywordReviewResponse,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.js";
import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";
import { AmazonMiningSchemas } from "../../src/plugins/amazon-product-mining/index.js";

const prompt = buildKeywordReviewPrompt({
  inputJsonPath: "/tmp/keyword-review-input.json",
  evidenceSlice: {
    taskId: "task-1",
    keywordId: "keyword-1",
    keyword: "desk organizer",
    taskScope: {
      amazonMarketplace: "amazon.com",
      targetMarket: "US",
      productDirection: "workspace accessories",
      requestedKeywordCount: 2,
      languagePreference: "en",
    },
    keywordStatus: "completed",
    evidenceSummary: {
      searchResultCount: 1,
      linkedProductCount: 1,
      linkedReviewCount: 1,
      imageRefCount: 1,
      exceptionCount: 0,
    },
    searchResults: [{
      itemId: "item-1",
      rankPosition: 1,
      isSponsored: false,
      title: "Desk Organizer",
      price: "$19.99",
      rating: "4.5 out of 5 stars",
      reviewCount: "120 ratings",
      productUrl: "https://www.amazon.com/dp/B000BOUND1",
      detailIds: ["detail-1"],
    }],
    linkedProducts: [{
      detailId: "detail-1",
      asin: "B000BOUND1",
      title: "Desk Organizer",
      currentPrice: "$19.99",
      rating: "4.5 out of 5 stars",
      reviewCount: "120 ratings",
      bestSellersRankIfVisible: "#4 in Desk Organizers",
      categoryPathIfVisible: "Office > Desk Accessories",
      starDistribution: "5 star 70%",
      status: "completed",
      sourceItemIds: ["item-1"],
      reviewSampleCount: 1,
      reviewSamples: [{
        reviewId: "review-1",
        rating: "4.0 out of 5 stars",
        reviewTitle: "Useful",
        reviewBody: "Solid product",
        verifiedPurchase: true,
      }],
      imageRefs: ["https://images.example.com/bound-1.jpg"],
    }],
    imageRefs: ["https://images.example.com/bound-1.jpg"],
    exceptions: [],
    completeness: {
      hasSearchResults: true,
      hasLinkedProducts: true,
      hasLinkedReviews: true,
      missingEvidence: [],
    },
  },
});

for (const requiredToken of [
  "You are not a final procurement decision AI.",
  "You are not a profit calculation AI.",
  "Demand Signal",
  "Review Health",
  "Price Ceiling",
  "Competition Openness",
  "Improvement Opportunity",
  "Data Confidence",
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
    aiResponseRef: null,
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