import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  runAmazonSearch,
  type SearchPageAdapter,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.search.js";

const taskId = "test-task-search";
const keywordId = randomUUID();
const keyword = "lightweight tent";

// --- Test 1: Adapter returns items successfully ---
const fixtureBuildItem = (rank: number) => ({
  itemId: randomUUID(),
  keywordId,
  taskId,
  keyword,
  searchUrl: `https://www.amazon.com/s?k=lightweight+tent`,
  rankPosition: rank,
  isSponsored: false,
  title: `Test Tent ${rank}`,
  productUrl: `https://www.amazon.com/dp/B001TEST0${rank}`,
  asinIfAvailable: `B001TEST0${rank}`,
  mainImageUrl: null,
  price: "$89.99",
  originalPriceOrDiscountIfVisible: null,
  rating: "4.5 out of 5",
  reviewCount: "200 ratings",
  primeOrFbaFlagIfVisible: "Prime",
  couponTextIfVisible: null,
  deliveryTextIfVisible: null,
  rawVisibleTextSnapshot: "test snapshot",
  createdAt: new Date().toISOString(),
});

const fixtureItems = [fixtureBuildItem(1), fixtureBuildItem(2), fixtureBuildItem(3)];

const successAdapter: SearchPageAdapter = {
  async extractSearchResults() {
    return fixtureItems;
  },
};

const result1 = await runAmazonSearch({
  marketplace: "amazon.com",
  keyword,
  keywordId,
  taskId,
  adapter: successAdapter,
});
assert.equal(result1.ok, true, "Success result should have ok=true");
if (!result1.ok) throw new Error("Expected ok=true");
assert.equal(result1.items.length, 3);
assert.equal(result1.items[0]!.title, "Test Tent 1");
assert.equal(result1.items[0]!.asinIfAvailable, "B001TEST01");
assert.equal(result1.items[0]!.rankPosition, 1);
assert.equal(result1.items[2]!.rankPosition, 3);
assert.equal(result1.searchUrl, `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`);

// --- Test 2: Adapter returns empty (no results) ---
const emptyAdapter: SearchPageAdapter = {
  async extractSearchResults() {
    return [];
  },
};
const result2 = await runAmazonSearch({
  marketplace: "amazon.com",
  keyword,
  keywordId,
  taskId,
  adapter: emptyAdapter,
});
assert.equal(result2.ok, true, "Empty result should still be ok=true");
if (!result2.ok) throw new Error("Expected ok=true for empty");
assert.equal(result2.items.length, 0);

// --- Test 3: captcha blocker ---
const captchaAdapter: SearchPageAdapter = {
  async extractSearchResults() {
    throw new Error("amazon_search_blocked:captcha");
  },
};
const result3 = await runAmazonSearch({
  marketplace: "amazon.com",
  keyword,
  keywordId,
  taskId,
  adapter: captchaAdapter,
});
assert.equal(result3.ok, false, "Captcha should result in ok=false");
if (result3.ok) throw new Error("Expected ok=false for captcha");
assert.equal(result3.blockerKind, "captcha");

// --- Test 4: login_required blocker ---
const loginAdapter: SearchPageAdapter = {
  async extractSearchResults() {
    throw new Error("amazon_search_blocked:login_required");
  },
};
const result4 = await runAmazonSearch({
  marketplace: "amazon.com",
  keyword,
  keywordId,
  taskId,
  adapter: loginAdapter,
});
assert.equal(result4.ok, false, "Login required should result in ok=false");
if (result4.ok) throw new Error("Expected ok=false for login_required");
assert.equal(result4.blockerKind, "login_required");

// --- Test 5: Marketplace URL is built correctly ---
const urlCheckAdapter: SearchPageAdapter = {
  async extractSearchResults(input) {
    assert.ok(input.searchUrl.startsWith("https://www.amazon.co.uk/s?k="), "UK marketplace URL should be correct");
    return [];
  },
};
const result5 = await runAmazonSearch({
  marketplace: "amazon.co.uk",
  keyword: "camping tent",
  keywordId: randomUUID(),
  taskId,
  adapter: urlCheckAdapter,
});
assert.equal(result5.ok, true);

// --- Test 6: No adapter or browser must not silently succeed ---
const result6 = await runAmazonSearch({
  marketplace: "amazon.ae",
  keyword: "storage organizer",
  keywordId: randomUUID(),
  taskId,
});
assert.equal(result6.ok, false, "Missing browser/adapter must be an honest extraction failure");
if (result6.ok) throw new Error("Expected ok=false for missing browser/adapter");
assert.equal(result6.blockerKind, "page_structure_unsupported");
assert.match(result6.reason, /No browser or adapter provided/u);

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-search-page\n");
