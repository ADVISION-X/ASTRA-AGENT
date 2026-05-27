import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";
import { AmazonMiningSchemas } from "../../src/plugins/amazon-product-mining/index.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-storage-test-"));

try {
  // --- Schema validation ---
  const input = AmazonMiningSchemas.AmazonMiningInputSchema.parse({
    amazonMarketplace: "amazon.com",
    targetMarket: "outdoor enthusiasts in the US",
    productDirection: "lightweight camping gear",
    requestedKeywordCount: 5,
    languagePreference: "en",
    providerKind: "gpt-web-chat",
  });
  assert.equal(input.amazonMarketplace, "amazon.com");
  assert.equal(input.requestedKeywordCount, 5);

  // --- Storage: create task ---
  const storage = createAmazonMiningStorage(dataDir);
  const taskId = randomUUID();
  const now = new Date().toISOString();

  const task = storage.createTask({
    taskId,
    amazonMarketplace: "amazon.com",
    targetMarket: "outdoor enthusiasts",
    productDirection: "camping gear",
    requestedKeywordCount: 5,
    languagePreference: "en",
    status: "created",
    failureReason: null,
    packageJsonPath: null,
    pdfReportPath: null,
    evidenceIndexPath: null,
    exceptionSummaryPath: null,
    handoffStatus: "not_started",
    createdAt: now,
    updatedAt: null,
  });
  assert.equal(task.taskId, taskId);
  assert.equal(task.status, "created");

  // --- Storage: get task ---
  const retrieved = storage.getTask(taskId);
  assert.ok(retrieved, "Task should be retrievable");
  assert.equal(retrieved.taskId, taskId);

  // --- Storage: latest task ---
  const latest = storage.getLatestTask();
  assert.ok(latest, "Latest task should exist");
  assert.equal(latest.taskId, taskId);

  // --- Storage: update task status ---
  storage.updateTaskStatus({ taskId, status: "keyword_generating" });
  const updated = storage.getTask(taskId);
  assert.equal(updated?.status, "keyword_generating");

  // --- Storage: save keywords ---
  const keywordId1 = randomUUID();
  const keywordId2 = randomUUID();
  storage.saveKeywords([
    { keywordId: keywordId1, taskId, keyword: "lightweight tent", source: "ai_generated", aiRunId: "run1", reason: null, status: "pending", createdAt: now, updatedAt: null },
    { keywordId: keywordId2, taskId, keyword: "camping cookware", source: "ai_generated", aiRunId: "run1", reason: null, status: "pending", createdAt: now, updatedAt: null },
  ]);
  const keywords = storage.getKeywordsForTask(taskId);
  assert.equal(keywords.length, 2);
  assert.ok(keywords.some((k) => k.keyword === "lightweight tent"), "Should find 'lightweight tent'");

  // --- Storage: dedup method ---
  const allMined = storage.getAllMinedKeywordsForDedup();
  assert.ok(allMined.includes("lightweight tent"), "Dedup list should include 'lightweight tent'");

  // --- Storage: AI keyword run ---
  storage.saveAiKeywordRun({
    runId: "run1",
    taskId,
    promptText: "generate keywords for camping gear",
    rawResponse: '{"keywords": [{"keyword": "lightweight tent"}, {"keyword": "camping cookware"}]}',
    parsedKeywords: ["lightweight tent", "camping cookware"],
    dedupedKeywords: ["lightweight tent", "camping cookware"],
    status: "success",
    failureReason: null,
  });

  // --- Storage: persist search results ---
  const itemId1 = randomUUID();
  storage.persistSearchResults([{
    itemId: itemId1,
    keywordId: keywordId1,
    taskId,
    keyword: "lightweight tent",
    searchUrl: "https://www.amazon.com/s?k=lightweight+tent",
    rankPosition: 1,
    isSponsored: false,
    title: "Ultra Light Tent 2P",
    productUrl: "https://www.amazon.com/dp/B001TEST01",
    asinIfAvailable: "B001TEST01",
    mainImageUrl: null,
    price: "$89.99",
    originalPriceOrDiscountIfVisible: null,
    rating: "4.5 out of 5",
    reviewCount: "234 ratings",
    primeOrFbaFlagIfVisible: "Prime",
    couponTextIfVisible: null,
    deliveryTextIfVisible: null,
    rawVisibleTextSnapshot: "Test search page snapshot",
    fieldDisclosureMap: {},
    createdAt: now,
  }]);
  const searchResults = storage.getSearchResultsForKeyword(keywordId1);
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0]!.asinIfAvailable, "B001TEST01");

  // --- Storage: persist product detail ---
  const detailId = randomUUID();
  const persistedDetailIdentity = {
    detailId,
    taskId,
    asin: "B001TEST01",
    productUrl: "https://www.amazon.com/dp/B001TEST01",
    title: "Ultra Light Tent 2P",
    brand: "TrailBlazer",
    sellerOrStoreIfVisible: "TrailBlazer Store",
    currentPrice: "$89.99",
    originalPriceDiscountCouponIfVisible: null,
  };

  const persistedDetailContent = {
    mainImage: null,
    allVisibleImages: [],
    visibleVideoInfo: null,
    bulletPoints: ["Lightweight", "2-person tent"],
    aboutThisItem: null,
    productDescription: "A lightweight 2-person tent for backpacking.",
    aPlusContentIfVisible: null,
    variationOptions: null,
    colorSizeStyleOptions: null,
  };

  const persistedDetailStatus = {
    productInformation: null,
    technicalDetails: null,
    additionalInformation: null,
    bestSellersRankIfVisible: null,
    categoryPathIfVisible: null,
    rating: "4.5 out of 5",
    reviewCount: "234 ratings",
    starDistribution: null,
    qaContentIfVisible: null,
    frequentlyBoughtTogetherIfVisible: null,
    customersAlsoBoughtIfVisible: null,
    compareWithSimilarItemsIfVisible: null,
    deliveryInformation: null,
    returnInformation: null,
    allOtherVisibleProductParameters: null,
    rawVisibleTextSnapshot: "Test detail page snapshot",
    fieldDisclosureMap: {},
    status: "pending_detail" as const,
    failureReason: null,
    createdAt: now,
    updatedAt: null,
  };

  storage.persistProductDetail({
    ...persistedDetailIdentity,
    ...persistedDetailContent,
    ...persistedDetailStatus,
  }, [itemId1]);
  const products = storage.getProductDetailsForTask(taskId);
  assert.equal(products.length, 1);
  assert.equal(products[0]!.asin, "B001TEST01");

  // --- Storage: persist reviews ---
  const reviewId = randomUUID();
  storage.persistReviews([{
    reviewId,
    detailId,
    taskId,
    asin: "B001TEST01",
    pageIndex: 0,
    reviewIdIfAvailable: "R123",
    reviewerName: "John D.",
    rating: "5.0 out of 5 stars",
    reviewTitle: "Great tent!",
    reviewBody: "Very lightweight and easy to set up.",
    reviewDate: "Reviewed on May 1, 2024",
    verifiedPurchase: true,
    variant: null,
    helpfulCountIfVisible: "12 people found this helpful",
    reviewImagesIfVisible: [],
    reviewVideosIfVisible: [],
    reviewLanguage: null,
    reviewRegionIfVisible: null,
    rawReviewTextSnapshot: "Great tent! Very lightweight and easy to set up.",
    fieldDisclosureMap: {},
    createdAt: now,
  }]);
  const reviews = storage.getReviewsForProduct(detailId);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]!.reviewTitle, "Great tent!");

  // --- Storage: persist exception ---
  storage.persistException({
    exceptionId: randomUUID(),
    taskId,
    scope: "search",
    scopeId: keywordId1,
    exceptionKind: "captcha",
    message: "CAPTCHA detected on search page",
  });
  const exceptions = storage.getExceptionsForTask(taskId);
  assert.equal(exceptions.length, 1);
  assert.equal(exceptions[0]!.exceptionKind, "captcha");

  storage.close();
  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-storage\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
