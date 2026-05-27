import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  buildReviewPageUrl,
  runReviewPagination,
  type ReviewPageAdapter,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.reviews.js";
import type { AmazonReviewRecord } from "../../src/plugins/amazon-product-mining/amazon-product-mining.schema.js";

const taskId = "test-task-reviews";
const detailId = randomUUID();
const asin = "B001TEST01";
const reviewsUrl = "https://www.amazon.com/product-reviews/B001TEST01";

const buildFixtureReview = (pageIndex: number, idx: number): AmazonReviewRecord => ({
  reviewId: randomUUID(),
  detailId,
  taskId,
  asin,
  pageIndex,
  reviewIdIfAvailable: `R${pageIndex}${idx}`,
  reviewerName: `Reviewer ${idx}`,
  rating: "5.0 out of 5 stars",
  reviewTitle: `Great product - page ${pageIndex} review ${idx}`,
  reviewBody: `This is a great product. Review ${idx} on page ${pageIndex}.`,
  reviewDate: "Reviewed on May 1, 2024",
  verifiedPurchase: true,
  variant: null,
  helpfulCountIfVisible: null,
  reviewImagesIfVisible: [],
  reviewVideosIfVisible: [],
  reviewLanguage: null,
  reviewRegionIfVisible: null,
  rawReviewTextSnapshot: `Great product. Review ${idx} page ${pageIndex}.`,
  fieldDisclosureMap: {},
  createdAt: new Date().toISOString(),
});

// --- Test 1: 3 pages, then no more ---
let callCount = 0;
const persistedPerPage: AmazonReviewRecord[][] = [];

const threePageAdapter: ReviewPageAdapter = {
  async extractReviewsFromPage({ pageIndex }) {
    const reviews = [buildFixtureReview(pageIndex, 1), buildFixtureReview(pageIndex, 2)];
    const hasNextPage = pageIndex < 2; // pages 0, 1, 2
    return { reviews, hasNextPage, restriction: null };
  },
};

const result1 = await runReviewPagination({
  reviewsUrl,
  detailId,
  taskId,
  asin,
  adapter: threePageAdapter,
  maxPages: 10,
  onPageExtracted: async (reviews, pageIndex) => {
    callCount++;
    persistedPerPage[pageIndex] = reviews;
  },
});

assert.equal(callCount, 3, "onPageExtracted must be called exactly 3 times (once per page)");
assert.equal(result1.totalPagesVisited, 3);
assert.equal(result1.totalReviewsCollected, 6, "2 reviews × 3 pages = 6");
assert.equal(result1.restriction, null);
assert.equal(persistedPerPage.length, 3, "Should have 3 pages of reviews persisted");
assert.equal(persistedPerPage[0]!.length, 2, "Page 0 should have 2 reviews");
assert.equal(persistedPerPage[1]!.length, 2, "Page 1 should have 2 reviews");
assert.equal(persistedPerPage[2]!.length, 2, "Page 2 should have 2 reviews");

// Verify reviews are for correct page
assert.equal(persistedPerPage[0]![0]!.pageIndex, 0);
assert.equal(persistedPerPage[1]![0]!.pageIndex, 1);
assert.equal(persistedPerPage[2]![0]!.pageIndex, 2);

// --- Test 2: Restriction on 4th page triggers manual_required ---
let callCount2 = 0;
const restrictionAdapter: ReviewPageAdapter = {
  async extractReviewsFromPage({ pageIndex }) {
    if (pageIndex >= 3) {
      return { reviews: [], hasNextPage: false, restriction: "manual_required" };
    }
    return {
      reviews: [buildFixtureReview(pageIndex, 1)],
      hasNextPage: true,
      restriction: null,
    };
  },
};

const result2 = await runReviewPagination({
  reviewsUrl,
  detailId,
  taskId,
  asin,
  adapter: restrictionAdapter,
  maxPages: 10,
  onPageExtracted: async () => { callCount2++; },
});

assert.equal(callCount2, 4, "onPageExtracted called 4 times (pages 0-3), page 3 triggers restriction");
assert.equal(result2.restriction, "manual_required");
assert.equal(result2.totalPagesVisited, 4);

// --- Test 3: maxPages cap respected ---
let callCount3 = 0;
const infiniteAdapter: ReviewPageAdapter = {
  async extractReviewsFromPage({ pageIndex }) {
    return {
      reviews: [buildFixtureReview(pageIndex, 1)],
      hasNextPage: true,
      restriction: null,
    };
  },
};

const result3 = await runReviewPagination({
  reviewsUrl,
  detailId,
  taskId,
  asin,
  adapter: infiniteAdapter,
  maxPages: 3,
  onPageExtracted: async () => { callCount3++; },
});

assert.equal(callCount3, 3, "maxPages=3 should cap at 3 onPageExtracted calls");
assert.equal(result3.totalPagesVisited, 3);

// --- Test 4: Empty first page (no reviews) is handled gracefully ---
let callCount4 = 0;
const emptyAdapter: ReviewPageAdapter = {
  async extractReviewsFromPage() {
    return { reviews: [], hasNextPage: false, restriction: null };
  },
};

const result4 = await runReviewPagination({
  reviewsUrl,
  detailId,
  taskId,
  asin,
  adapter: emptyAdapter,
  onPageExtracted: async () => { callCount4++; },
});

assert.equal(callCount4, 1, "Even empty first page should call onPageExtracted once");
assert.equal(result4.totalReviewsCollected, 0);

// --- Test 5: pageNumber is appended without corrupting existing review URL query ---
assert.equal(
  buildReviewPageUrl("https://www.amazon.ae/product-reviews/B001TEST01?reviewerType=all_reviews", 1),
  "https://www.amazon.ae/product-reviews/B001TEST01?reviewerType=all_reviews&pageNumber=2",
);

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-review-pagination\n");
