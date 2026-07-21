import { join } from "node:path";

import type {
  AmazonKeywordOpportunityReviewRecord,
  AmazonProductDetail,
  AmazonReviewRecord,
  AmazonSearchResultItem,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-artifact-builders.js";
import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";

const buildAcceptanceKeywords = (input: {
  taskId: string;
  keywordRunId: string;
}) => [
  {
    keywordId: "kw-1",
    taskId: input.taskId,
    keyword: "portable camping stove",
    source: "ai_generated" as const,
    aiRunId: input.keywordRunId,
    status: "completed" as const,
    reason: null,
    keywordHistoryRelation: "new_keyword" as const,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
  {
    keywordId: "kw-2",
    taskId: input.taskId,
    keyword: "backpacking gas stove",
    source: "ai_generated" as const,
    aiRunId: input.keywordRunId,
    status: "completed" as const,
    reason: null,
    keywordHistoryRelation: "new_keyword" as const,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
];

const buildAcceptanceSearchResults = (taskId: string): AmazonSearchResultItem[] => [
  {
    itemId: "item-1",
    taskId,
    keywordId: "kw-1",
    keyword: "portable camping stove",
    searchUrl: "https://www.amazon.com/s?k=portable+camping+stove",
    rankPosition: 1,
    isSponsored: false,
    title: "SummitLite Backpacking Stove",
    productUrl: "https://www.amazon.com/dp/B000000001",
    asinIfAvailable: "B000000001",
    mainImageUrl: "https://images.example.com/item-1.jpg",
    price: "$29.99",
    originalPriceOrDiscountIfVisible: "$39.99 / Save 10%",
    rating: "4.6",
    reviewCount: "1200",
    primeOrFbaFlagIfVisible: "Prime",
    couponTextIfVisible: "Save 10%",
    deliveryTextIfVisible: "Free delivery",
    rawVisibleTextSnapshot: "SummitLite Backpacking Stove Prime Save 10%",
    fieldDisclosureMap: {},
    createdAt: new Date().toISOString(),
  },
  {
    itemId: "item-2",
    taskId,
    keywordId: "kw-2",
    keyword: "backpacking gas stove",
    searchUrl: "https://www.amazon.com/s?k=backpacking+gas+stove",
    rankPosition: 2,
    isSponsored: true,
    title: "TrailBurn Ultralight Stove",
    productUrl: "https://www.amazon.com/dp/B000000002",
    asinIfAvailable: "B000000002",
    mainImageUrl: "https://images.example.com/item-2.jpg",
    price: "$35.99",
    originalPriceOrDiscountIfVisible: null,
    rating: "4.4",
    reviewCount: "860",
    primeOrFbaFlagIfVisible: "Prime",
    couponTextIfVisible: null,
    deliveryTextIfVisible: "Overnight delivery",
    rawVisibleTextSnapshot: "TrailBurn Ultralight Stove Prime",
    fieldDisclosureMap: {},
    createdAt: new Date().toISOString(),
  },
];

const buildAcceptanceReviews = (taskId: string): AmazonReviewRecord[] => [
  {
    reviewId: "review-1",
    detailId: "detail-1",
    taskId,
    asin: "B000000001",
    pageIndex: 1,
    reviewIdIfAvailable: null,
    reviewTitle: "Excellent flame control",
    rating: "5.0",
    reviewBody: "Boils fast and packs small.",
    reviewDate: "2024-01-01",
    reviewerName: "Alice",
    variant: "Color: Blue",
    verifiedPurchase: true,
    helpfulCountIfVisible: "12 people found this helpful",
    reviewImagesIfVisible: ["https://images.example.com/review-1.jpg"],
    reviewVideosIfVisible: [],
    reviewLanguage: "en",
    reviewRegionIfVisible: "US",
    rawReviewTextSnapshot: "Raw review snapshot page 1",
    fieldDisclosureMap: {},
    createdAt: new Date().toISOString(),
  },
  {
    reviewId: "review-2",
    detailId: "detail-2",
    taskId,
    asin: "B000000002",
    pageIndex: 2,
    reviewIdIfAvailable: null,
    reviewTitle: "Good but louder ignition",
    rating: "4.0",
    reviewBody: "Solid stove, slightly loud.",
    reviewDate: "2024-02-02",
    reviewerName: "Bob",
    variant: null,
    verifiedPurchase: true,
    helpfulCountIfVisible: "4 people found this helpful",
    reviewImagesIfVisible: [],
    reviewVideosIfVisible: ["short clip"],
    reviewLanguage: "en",
    reviewRegionIfVisible: "US",
    rawReviewTextSnapshot: "Raw review snapshot page 2",
    fieldDisclosureMap: {},
    createdAt: new Date().toISOString(),
  },
];

const buildCompletedKeywordOpportunityReview = (input: {
  dataDir: string;
  taskId: string;
  keywordId: string;
  keyword: string;
}): AmazonKeywordOpportunityReviewRecord => {
  const now = new Date().toISOString();
  return {
    reviewId: `review-${input.keywordId}`,
    taskId: input.taskId,
    keywordId: input.keywordId,
    keyword: input.keyword,
    status: "completed",
    decision: "PASS",
    demandSignal: "strong",
    reviewHealth: "medium",
    priceCeiling: "medium",
    competitionOpenness: "medium",
    improvementOpportunity: "strong",
    dataConfidence: "medium",
    evidenceRefs: [`keyword-${input.keywordId}-evidence`],
    missingEvidence: [],
    riskPoints: ["validate landed cost later"],
    humanNextStep: "enter_next_validation",
    aiPromptText: "Review keyword opportunity package.",
    aiRawResponse: "{\"decision\":\"PASS\"}",
    aiResponseRef: join(input.dataDir, `${input.keywordId}-keyword-review-response.json`),
    packageRef: join(input.dataDir, `${input.keywordId}-full-evidence-package`),
    keywordPackageSliceRef: join(input.dataDir, `${input.keywordId}-navigation.json`),
    failureReason: null,
    createdAt: now,
    updatedAt: null,
  };
};

export const seedAmazonProductMiningPackageAcceptanceStorage = (input: {
  dataDir: string;
  taskId: string;
  keywordRunId: string;
  products: readonly AmazonProductDetail[];
}) => {
  const storage = createAmazonMiningStorage(input.dataDir);
  storage.createTask({
    taskId: input.taskId,
    amazonMarketplace: "amazon.com",
    targetMarket: "US",
    productDirection: "portable camping stove",
    requestedKeywordCount: 2,
    languagePreference: "en",
    providerKind: "gpt-web-chat",
    keywordHistoryPolicy: "new_keywords_only",
    status: "packaging",
    failureReason: null,
    packageJsonPath: null,
    pdfReportPath: null,
    evidenceIndexPath: null,
    exceptionSummaryPath: null,
    handoffStatus: "not_started",
    createdAt: new Date().toISOString(),
    updatedAt: null,
  });
  storage.saveAiKeywordRun({
    runId: input.keywordRunId,
    taskId: input.taskId,
    promptText: "Generate Amazon keywords for portable camping stove.",
    rawResponse: "[\"portable camping stove\", \"backpacking gas stove\"]",
    parsedKeywords: ["portable camping stove", "backpacking gas stove"],
    dedupedKeywords: ["portable camping stove", "backpacking gas stove"],
    status: "success",
    failureReason: null,
  });
  storage.saveKeywords(buildAcceptanceKeywords({ taskId: input.taskId, keywordRunId: input.keywordRunId }));
  for (const keyword of buildAcceptanceKeywords({ taskId: input.taskId, keywordRunId: input.keywordRunId })) {
    storage.saveKeywordOpportunityReview(buildCompletedKeywordOpportunityReview({
      dataDir: input.dataDir,
      taskId: input.taskId,
      keywordId: keyword.keywordId,
      keyword: keyword.keyword,
    }));
  }
  storage.persistSearchResults(buildAcceptanceSearchResults(input.taskId));
  input.products.forEach((product, index) => {
    storage.persistProductDetail(product, [`item-${index + 1}`]);
  });
  storage.persistReviews(buildAcceptanceReviews(input.taskId));
  storage.persistException({
    exceptionId: "exception-1",
    taskId: input.taskId,
    scope: "product_detail",
    scopeId: "detail-2",
    exceptionKind: "detail_warning",
    message: "Secondary image set is limited.",
  });
  return storage;
};
