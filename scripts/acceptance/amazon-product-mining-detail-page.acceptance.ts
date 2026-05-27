import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  runProductDetailExtraction,
  type DetailPageAdapter,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.product-detail.js";

const taskId = "test-task-detail";
const asin = "B001TEST01";
const productUrl = "https://www.amazon.com/dp/B001TEST01";

const fixtureDetailIdentity = {
  detailId: randomUUID(),
  taskId,
  asin,
  productUrl,
  title: "Ultra Light Tent 2P",
  brand: "TrailBlazer",
  sellerOrStoreIfVisible: "TrailBlazer Store",
  currentPrice: "$89.99",
  originalPriceDiscountCouponIfVisible: "$10 coupon available",
};

const fixtureDetailMedia = {
  mainImage: "https://images.amazon.com/test-main.jpg",
  allVisibleImages: [
    "https://images.amazon.com/test-main.jpg",
    "https://images.amazon.com/test-alt1.jpg",
  ],
  visibleVideoInfo: null,
  bulletPoints: ["Lightweight 2.4 lbs", "Easy setup 2-person", "Waterproof coating"],
  aboutThisItem: "Perfect for backpacking trips.",
  productDescription: "A lightweight 2-person tent for backpacking adventures.",
  aPlusContentIfVisible: null,
  variationOptions: null,
  colorSizeStyleOptions: null,
};

const fixtureDetailCatalog = {
  productInformation: null,
  technicalDetails: "Weight: 2.4 lbs, Size: 84x48x40 inches",
  additionalInformation: null,
  bestSellersRankIfVisible: "#47 in Camping Tents",
  categoryPathIfVisible: "Sports & Outdoors > Camping & Hiking > Tents",
  rating: "4.5 out of 5 stars",
  reviewCount: "234 global ratings",
  starDistribution: null,
  qaContentIfVisible: null,
  frequentlyBoughtTogetherIfVisible: null,
  customersAlsoBoughtIfVisible: null,
  compareWithSimilarItemsIfVisible: null,
  deliveryInformation: "FREE delivery on orders over $25",
  returnInformation: null,
  allOtherVisibleProductParameters: null,
};

const fixtureDetailStatus = {
  rawVisibleTextSnapshot: "Ultra Light Tent 2P by TrailBlazer $89.99 4.5 stars...",
  fieldDisclosureMap: {},
  status: "pending_detail" as const,
  failureReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
};

const fixtureDetail = {
  ...fixtureDetailIdentity,
  ...fixtureDetailMedia,
  ...fixtureDetailCatalog,
  ...fixtureDetailStatus,
};

// --- Test 1: Adapter returns full product detail ---
const successAdapter: DetailPageAdapter = {
  async extractProductDetail() {
    return { ...fixtureDetail };
  },
};

const detail1 = await runProductDetailExtraction({
  productUrl,
  asin,
  taskId,
  adapter: successAdapter,
});

assert.equal(detail1.asin, asin);
assert.equal(detail1.title, "Ultra Light Tent 2P");
assert.equal(detail1.brand, "TrailBlazer");
assert.equal(detail1.sellerOrStoreIfVisible, "TrailBlazer Store");
assert.equal(detail1.currentPrice, "$89.99");
assert.equal(detail1.originalPriceDiscountCouponIfVisible, "$10 coupon available");
assert.equal(detail1.mainImage, "https://images.amazon.com/test-main.jpg");
assert.equal(detail1.allVisibleImages.length, 2);
assert.equal(detail1.bulletPoints.length, 3);
assert.ok(detail1.bulletPoints[0]!.includes("Lightweight"), "First bullet should mention Lightweight");
assert.equal(detail1.technicalDetails, "Weight: 2.4 lbs, Size: 84x48x40 inches");
assert.equal(detail1.bestSellersRankIfVisible, "#47 in Camping Tents");
assert.equal(detail1.status, "pending_detail");

// --- Test 2: Adapter is passed the correct inputs ---
const inputCheckAdapter: DetailPageAdapter = {
  async extractProductDetail(input) {
    assert.equal(input.productUrl, "https://www.amazon.com/dp/B002TEST02");
    assert.equal(input.asin, "B002TEST02");
    assert.equal(input.taskId, taskId);
    return { ...fixtureDetail, asin: "B002TEST02", productUrl: "https://www.amazon.com/dp/B002TEST02" };
  },
};

const detail2 = await runProductDetailExtraction({
  productUrl: "https://www.amazon.com/dp/B002TEST02",
  asin: "B002TEST02",
  taskId,
  adapter: inputCheckAdapter,
});
assert.equal(detail2.asin, "B002TEST02");

// --- Test 3: Adapter returns null optional fields gracefully ---
const minimalAdapter: DetailPageAdapter = {
  async extractProductDetail() {
    return {
      ...fixtureDetail,
      brand: null,
      sellerOrStoreIfVisible: null,
      currentPrice: null,
      originalPriceDiscountCouponIfVisible: null,
      mainImage: null,
      allVisibleImages: [],
      bulletPoints: [],
      technicalDetails: null,
      bestSellersRankIfVisible: null,
      rawVisibleTextSnapshot: "minimal snapshot",
    };
  },
};

const detail3 = await runProductDetailExtraction({
  productUrl,
  asin,
  taskId,
  adapter: minimalAdapter,
});
assert.equal(detail3.brand, null);
assert.equal(detail3.allVisibleImages.length, 0);
assert.equal(detail3.bulletPoints.length, 0);

// --- Test 4: No adapter or browser throws ---
try {
  await runProductDetailExtraction({
    productUrl,
    asin,
    taskId,
  });
  assert.fail("Should throw when no adapter and no browser");
} catch (err) {
  assert.ok(err instanceof Error, "Should throw an Error");
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-detail-page\n");
