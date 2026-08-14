import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { BrowserActionResult, BrowserTargetSession } from "../../src/lib/browser/browser-controller.js";
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
  fieldDisclosureMap: {},
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

// --- Test 7: Null/invalid extraction output must not surface as a low-level JS error ---
const invalidAdapter = {
  async extractSearchResults() {
    throw new Error("amazon_search_extract_invalid_items");
  },
} satisfies SearchPageAdapter;
const result7 = await runAmazonSearch({
  marketplace: "amazon.ae",
  keyword: "magnetic screen door",
  keywordId: randomUUID(),
  taskId,
  adapter: invalidAdapter,
});
assert.equal(result7.ok, false, "Invalid extraction output must be a structured failure");
if (result7.ok) throw new Error("Expected ok=false for invalid extraction output");
assert.equal(result7.blockerKind, "page_structure_unsupported");
assert.match(result7.reason, /amazon_search_extract_invalid_items/u);

// --- Test 8: Sponsored click URLs must be normalized to canonical product URLs ---
const sponsoredAction = (message: string): BrowserActionResult => ({
  browserActionId: `${message}-${Date.now()}`,
  ok: true,
  message,
  createdAt: new Date().toISOString(),
});
const sponsoredBrowser = {
  getHealth: () => ({ ok: true, detail: "sponsored-url-normalization" }),
  getSessionState: () => ({
    open: true,
    browserMode: "fixture" as const,
    browserProfileRef: "acceptance",
    browserExecutablePath: null,
    profileStatus: "profile_ready" as const,
    currentUrl: "https://www.amazon.ae/s?k=water+bottle",
    currentTitle: "Amazon acceptance",
    browserExecutable: null,
    profileDirectory: "acceptance",
    profileProvisioning: "managed_default" as const,
    profileVerificationStatus: "default_unverified" as const,
    profileVerificationReason: null,
    loginState: "unknown" as const,
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  }),
  getGeometrySnapshot: async () => ({
    windowX: 0,
    windowY: 0,
    viewportWidth: 1200,
    viewportHeight: 900,
    screenshotWidth: 1200,
    screenshotHeight: 900,
    scaleFactor: 1,
    currentUrl: "https://www.amazon.ae/s?k=water+bottle",
    pageTitle: "Amazon acceptance",
    visibleContentBounds: { x: 0, y: 0, width: 1200, height: 900 },
    capturedAt: new Date().toISOString(),
  }),
  open: async () => sponsoredAction("opened"),
  scroll: async () => sponsoredAction("scrolled"),
  click: async () => sponsoredAction("clicked"),
  clickLocatedDomElement: async () => sponsoredAction("clicked-dom"),
  textInput: async () => sponsoredAction("text-input"),
  screenshotRegion: async () => ({
    ...sponsoredAction("screenshot"),
    pageUrl: "https://www.amazon.ae/s?k=water+bottle",
    pageTitle: "Amazon acceptance",
    regionLabel: "acceptance",
    regionType: "viewport",
    width: 1200,
    height: 900,
    viewportWidth: 1200,
    viewportHeight: 900,
    sourceFilePath: "/tmp/acceptance.png",
  }),
  evaluate: async <T,>(): Promise<T> => ({
    items: [{
      asin: "B0SPONSOR1",
      title: "Sponsored Bottle",
      productUrl: "https://www.amazon.ae/sspa/click?url=%2FActual-Product%2Fdp%2FB0SPONSOR1%2Fref%3Dsr_1_1_sspa&spc=abc",
      price: "AED 25.00",
      rating: "4.4 out of 5 stars",
      reviewCount: "500 ratings",
      mainImageUrl: null,
      isSponsored: true,
      rankPosition: 1,
      primeOrFba: "Prime",
      couponText: null,
      originalPriceOrDiscount: null,
      deliveryText: null,
    }],
    rawText: "Sponsored Bottle AED 25.00 Prime",
    totalCards: 1,
  } as T),
  setFileInputFiles: async () => sponsoredAction("files-set"),
  wait: async () => sponsoredAction("waited"),
  closeTarget: async () => sponsoredAction("closed-tab"),
  close: async () => sponsoredAction("closed"),
} satisfies BrowserTargetSession;
const result8 = await runAmazonSearch({
  marketplace: "amazon.ae",
  keyword: "water bottle",
  keywordId: randomUUID(),
  taskId,
  browser: sponsoredBrowser,
});
assert.equal(result8.ok, true, "Sponsored URL browser extraction should succeed");
if (!result8.ok) throw new Error("Expected ok=true for sponsored URL browser extraction");
assert.equal(result8.items[0]?.productUrl, "https://www.amazon.ae/Actual-Product/dp/B0SPONSOR1/ref=sr_1_1_sspa");

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-search-page\n");
