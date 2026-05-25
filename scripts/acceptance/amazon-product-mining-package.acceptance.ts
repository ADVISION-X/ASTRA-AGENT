import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";
import { buildAmazonProductMiningPackage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-package-test-"));

try {
  const storage = createAmazonMiningStorage(dataDir);
  const taskId = randomUUID();
  const now = new Date().toISOString();

  // --- Seed task ---
  storage.createTask({
    taskId,
    amazonMarketplace: "amazon.com",
    targetMarket: "outdoor enthusiasts",
    productDirection: "camping gear",
    requestedKeywordCount: 5,
    languagePreference: "en",
    status: "packaging",
    failureReason: null,
    packageJsonPath: null,
    pdfReportPath: null,
    evidenceIndexPath: null,
    exceptionSummaryPath: null,
    handoffStatus: "not_started",
    createdAt: now,
    updatedAt: null,
  });

  // --- Seed keywords ---
  const keywordId1 = randomUUID();
  const keywordId2 = randomUUID();
  storage.saveKeywords([
    { keywordId: keywordId1, taskId, keyword: "lightweight tent", source: "ai_generated", aiRunId: "run1", reason: null, status: "completed" as const, createdAt: now, updatedAt: null },
    { keywordId: keywordId2, taskId, keyword: "camping stove", source: "ai_generated", aiRunId: "run1", reason: null, status: "completed" as const, createdAt: now, updatedAt: null },
  ]);

  // --- Seed search results (before details per law 005) ---
  const itemId1 = randomUUID();
  const itemId2 = randomUUID();
  storage.persistSearchResults([
    {
      itemId: itemId1, keywordId: keywordId1, taskId, keyword: "lightweight tent",
      searchUrl: "https://www.amazon.com/s?k=lightweight+tent",
      rankPosition: 1, isSponsored: false, title: "Ultra Light Tent", productUrl: "https://www.amazon.com/dp/B001",
      asinIfAvailable: "B001TENT01", mainImageUrl: null, price: "$89.99",
      originalPriceOrDiscountIfVisible: null, rating: "4.5 out of 5", reviewCount: "200",
      primeOrFbaFlagIfVisible: "Prime", couponTextIfVisible: null, deliveryTextIfVisible: null,
      rawVisibleTextSnapshot: "test", createdAt: now,
    },
    {
      itemId: itemId2, keywordId: keywordId2, taskId, keyword: "camping stove",
      searchUrl: "https://www.amazon.com/s?k=camping+stove",
      rankPosition: 1, isSponsored: false, title: "Camp Stove Pro", productUrl: "https://www.amazon.com/dp/B002",
      asinIfAvailable: "B002STOV01", mainImageUrl: null, price: "$45.00",
      originalPriceOrDiscountIfVisible: null, rating: "4.3 out of 5", reviewCount: "150",
      primeOrFbaFlagIfVisible: null, couponTextIfVisible: null, deliveryTextIfVisible: null,
      rawVisibleTextSnapshot: "stove snapshot", createdAt: now,
    },
  ]);

  // --- Seed product details ---
  const detailId1 = randomUUID();
  const detailId2 = randomUUID();
  const buildDetail = (detailId: string, asin: string, title: string) => {
    const identity = {
      detailId,
      taskId,
      asin,
      productUrl: `https://www.amazon.com/dp/${asin}`,
      title,
      brand: "TrailGear",
      sellerOrStoreIfVisible: "TrailGear Store",
      currentPrice: "$89.99",
      originalPriceDiscountCouponIfVisible: null,
    };

    const mediaAndContent = {
      mainImage: null,
      allVisibleImages: [],
      visibleVideoInfo: null,
      bulletPoints: ["Feature 1", "Feature 2"],
      aboutThisItem: null,
      productDescription: "Good product.",
      aPlusContentIfVisible: null,
      variationOptions: null,
      colorSizeStyleOptions: null,
    };

    const catalogAndStatus = {
      productInformation: null,
      technicalDetails: null,
      additionalInformation: null,
      bestSellersRankIfVisible: null,
      categoryPathIfVisible: null,
      rating: "4.5 out of 5",
      reviewCount: "200 ratings",
      starDistribution: null,
      qaContentIfVisible: null,
      frequentlyBoughtTogetherIfVisible: null,
      customersAlsoBoughtIfVisible: null,
      compareWithSimilarItemsIfVisible: null,
      deliveryInformation: null,
      returnInformation: null,
      allOtherVisibleProductParameters: null,
      rawVisibleTextSnapshot: `${title} snapshot`,
      status: "completed" as const,
      failureReason: null,
      createdAt: now,
      updatedAt: null,
    };

    return {
      ...identity,
      ...mediaAndContent,
      ...catalogAndStatus,
    };
  };
  storage.persistProductDetail(buildDetail(detailId1, "B001TENT01", "Ultra Light Tent"), [itemId1]);
  storage.persistProductDetail(buildDetail(detailId2, "B002STOV01", "Camp Stove Pro"), [itemId2]);

  // --- Seed reviews ---
  const buildReview = (reviewId: string, detailId: string, asin: string, pageIndex: number) => ({
    reviewId, detailId, taskId, asin, pageIndex,
    reviewIdIfAvailable: `R${reviewId.slice(0, 6)}`,
    reviewerName: "Test Reviewer", rating: "5.0 out of 5 stars",
    reviewTitle: "Excellent product", reviewBody: "I love this product.",
    reviewDate: "Reviewed on January 1, 2024",
    verifiedPurchase: true, variant: null, helpfulCountIfVisible: null,
    reviewImagesIfVisible: [], reviewVideosIfVisible: [],
    reviewLanguage: null, reviewRegionIfVisible: null,
    rawReviewTextSnapshot: "Excellent product I love it.",
    createdAt: now,
  });
  storage.persistReviews([
    buildReview(randomUUID(), detailId1, "B001TENT01", 0),
    buildReview(randomUUID(), detailId1, "B001TENT01", 0),
    buildReview(randomUUID(), detailId2, "B002STOV01", 0),
  ]);

  // --- Seed exception ---
  storage.persistException({
    exceptionId: randomUUID(),
    taskId,
    scope: "search",
    scopeId: keywordId1,
    exceptionKind: "rate_limited",
    message: "Rate limited on page 2",
  });

  // --- Build package ---
  const packageResult = await buildAmazonProductMiningPackage({ taskId, dataDir, storage });

  assert.ok(packageResult.packageJsonPath, "packageJsonPath should be non-empty");
  assert.ok(packageResult.evidenceIndexPath, "evidenceIndexPath should be non-empty");
  assert.ok(packageResult.exceptionSummaryPath, "exceptionSummaryPath should be non-empty");
  assert.equal(packageResult.productCount, 2, "Should have 2 products");
  assert.equal(packageResult.reviewCount, 3, "Should have 3 reviews total");
  assert.equal(packageResult.keywordCount, 2, "Should have 2 keywords");

  // --- Verify JSON package file exists and has correct structure ---
  assert.ok(existsSync(packageResult.packageJsonPath), "packageJsonPath file must exist on disk");
  const packageJson = JSON.parse(readFileSync(packageResult.packageJsonPath, "utf8"));
  assert.ok(packageJson.task_id, "Package JSON must have task_id");
  assert.ok(Array.isArray(packageJson.keywords), "Package JSON must have keywords array");
  assert.ok(Array.isArray(packageJson.products), "Package JSON must have products array");
  assert.equal(packageJson.products.length, 2, "Should have 2 products in JSON");
  assert.equal(packageJson.keywords.length, 2, "Should have 2 keywords in JSON");

  // --- Verify no final product selection conclusions ---
  const packageText = readFileSync(packageResult.packageJsonPath, "utf8");
  assert.ok(
    !packageText.includes("recommendedProduct") && !packageText.includes("bestProduct") && !packageText.includes("finalSelection"),
    "Package JSON must NOT contain final product selection conclusions"
  );

  // --- Verify evidence index exists ---
  assert.ok(existsSync(packageResult.evidenceIndexPath), "evidenceIndexPath must exist on disk");

  // --- Verify exception summary exists ---
  assert.ok(existsSync(packageResult.exceptionSummaryPath), "exceptionSummaryPath must exist on disk");
  const exceptionSummary = JSON.parse(readFileSync(packageResult.exceptionSummaryPath, "utf8"));
  assert.ok(Array.isArray(exceptionSummary.exceptions), "Exception summary must have exceptions array");
  assert.equal(exceptionSummary.exceptions.length, 1);
  assert.equal(exceptionSummary.exceptions[0].exceptionKind, "rate_limited");

  storage.close();
  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-package\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
