import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  buildFieldDisclosureMap,
  fieldDisclosureFromValue,
} from "./amazon-product-mining.field-disclosure.js";
import type { AmazonSearchResultItem } from "./amazon-product-mining.schema.js";

export type SearchPageAdapter = {
  extractSearchResults(input: { keyword: string; searchUrl: string; keywordId: string; taskId: string }): Promise<AmazonSearchResultItem[]>;
};

type SearchBlockerKind =
  | "login_required"
  | "captcha"
  | "rate_limited"
  | "region_restricted"
  | "page_structure_unsupported";

export type SearchResult =
  | { ok: true; items: AmazonSearchResultItem[]; searchUrl: string }
  | { ok: false; blockerKind: SearchBlockerKind; reason: string };

const AMAZON_SEARCH_EXTRACT_SCRIPT = `
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text.replace(/\s+/g, ' ').trim();
  };
  var pickText = function(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var element = root.querySelector(selectors[i]);
      var text = normalizeText(element && element.textContent ? element.textContent : null);
      if (text) return text;
    }
    return null;
  };
  var matchCommercialLine = function(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var match = text.match(patterns[i]);
      if (match && match[0]) return normalizeText(match[0]);
    }
    return null;
  };
  var body = document.body.innerText || "";
  // Detect blocker conditions
  if (document.querySelector('input[name="email"]') || document.querySelector('#ap_email')) {
    return { blocker: "login_required" };
  }
  if (document.querySelector('form[action*="captcha"]') || document.querySelector('#captchacharacters')) {
    return { blocker: "captcha" };
  }
  var items = [];
  // Try s-result-item approach (standard Amazon search)
  var cards = document.querySelectorAll('[data-component-type="s-search-result"]');
  if (cards.length === 0) {
    cards = document.querySelectorAll('[data-asin]');
  }
  var rank = 0;
  cards.forEach(function(card) {
    var asin = card.getAttribute('data-asin') || null;
    var cardText = normalizeText(card.innerText || '') || '';
    var titleEl = card.querySelector('h2 a span') || card.querySelector('.a-size-medium') || card.querySelector('.a-size-base-plus');
    var title = titleEl ? titleEl.textContent.trim() : null;
    var linkEl = card.querySelector('h2 a') || card.querySelector('a.a-link-normal');
    var href = linkEl ? linkEl.getAttribute('href') : null;
    if (!href) return;
    var productUrl = href.startsWith('http') ? href : ('https://' + window.location.host + href);
    var priceEl = card.querySelector('.a-price .a-offscreen') || card.querySelector('.a-price');
    var price = priceEl ? priceEl.textContent.trim() : null;
    var ratingEl = card.querySelector('.a-icon-star-small .a-icon-alt') || card.querySelector('[aria-label*="out of 5"]');
    var rating = ratingEl ? (ratingEl.textContent || ratingEl.getAttribute('aria-label') || null) : null;
    var reviewCountEl = card.querySelector('.a-size-base.s-underline-text') || card.querySelector('[aria-label*="ratings"]');
    var reviewCount = reviewCountEl ? reviewCountEl.textContent.trim() : null;
    var imgEl = card.querySelector('img.s-image') || card.querySelector('img[src*="images/I/"]');
    var mainImageUrl = imgEl ? imgEl.getAttribute('src') : null;
    var badgeText = card.querySelector('.s-sponsored-label-text');
    var isSponsored = badgeText ? badgeText.textContent.toLowerCase().includes('sponsored') : false;
    if (!isSponsored) {
      var sponsorDiv = card.querySelector('.s-label-popover-hover');
      if (sponsorDiv) isSponsored = true;
    }
    var primeEl = card.querySelector('[aria-label="Amazon Prime"]')
      || card.querySelector('.s-prime')
      || card.querySelector('[data-cy="prime-badge"]');
    var primeOrFba = primeEl ? 'Prime' : null;
    if (!primeOrFba && /fulfilled by amazon|fba/i.test(cardText)) {
      primeOrFba = 'Fulfilled by Amazon';
    }
    var couponEl = card.querySelector('.s-coupon-unclipped span')
      || card.querySelector('.couponBadge')
      || card.querySelector('[aria-label*="coupon"]');
    var couponText = couponEl ? normalizeText(couponEl.textContent) : matchCommercialLine(cardText, [/(?:Save|Coupon|Apply)\s+[^\n]+/i]);
    var originalPrice = pickText(card, [
      '.a-price.a-text-price .a-offscreen',
      '.a-price[data-a-strike="true"] .a-offscreen',
      '.a-price.a-text-price span[aria-hidden="true"]',
      '.basisPrice .a-offscreen',
      '.a-price[data-a-color="secondary"] .a-offscreen'
    ]);
    var discountText = matchCommercialLine(cardText, [/(?:Save\s+[^\n]+|\d+%\s+off|Limited time deal[^\n]*)/i]);
    var originalPriceOrDiscount = originalPrice || discountText;
    var deliveryText = pickText(card, [
      '[data-cy="delivery-recipe"]',
      '.a-color-base.a-text-bold',
      '.a-color-secondary .a-text-bold',
      '.a-row.a-size-base.a-color-secondary'
    ]);
    if (!deliveryText) {
      deliveryText = matchCommercialLine(cardText, [/(?:FREE delivery[^\n]*|Delivery[^\n]*|Get it by[^\n]*|Arrives[^\n]*|Overnight delivery[^\n]*)/i]);
    }
    rank++;
    items.push({
      asin: asin,
      title: title,
      productUrl: productUrl,
      price: price,
      rating: rating,
      reviewCount: reviewCount,
      mainImageUrl: mainImageUrl,
      isSponsored: isSponsored,
      rankPosition: rank,
      primeOrFba: primeOrFba,
      couponText: couponText,
      originalPriceOrDiscount: originalPriceOrDiscount,
      deliveryText: deliveryText,
    });
  });
  return { items: items, rawText: document.body.innerText.substring(0, 8000) };
})();
`;

type ExtractedItem = {
  asin: string | null;
  title: string | null;
  productUrl: string;
  price: string | null;
  rating: string | null;
  reviewCount: string | null;
  mainImageUrl: string | null;
  isSponsored: boolean;
  rankPosition: number;
  primeOrFba: string | null;
  couponText: string | null;
  originalPriceOrDiscount: string | null;
  deliveryText: string | null;
};

type ExtractResult =
  | { blocker: string }
  | { items: ExtractedItem[]; rawText: string };

const buildBrowserSearchAdapter = (browser: BrowserController, marketplace: string): SearchPageAdapter => ({
  async extractSearchResults({ keyword, keywordId, taskId }) {
    const searchUrl = `https://www.${marketplace}/s?k=${encodeURIComponent(keyword)}`;
    await browser.open({
      url: searchUrl,
      title: `Amazon search: ${keyword}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(3000);

    const result = await browser.evaluateActiveTab<ExtractResult>({
      script: AMAZON_SEARCH_EXTRACT_SCRIPT,
      description: `Extract Amazon search results for keyword: ${keyword}`,
    });

    if (!result || typeof result !== "object") {
      throw new Error("amazon_search_extract_invalid_result");
    }
    if ("blocker" in result) {
      throw new Error(`amazon_search_blocked:${result.blocker}`);
    }
    if (!Array.isArray(result.items)) {
      throw new Error("amazon_search_extract_invalid_items");
    }

    const now = new Date().toISOString();
    return result.items.map((item) => ({
      itemId: randomUUID(),
      keywordId,
      taskId,
      keyword,
      searchUrl,
      rankPosition: item.rankPosition,
      isSponsored: item.isSponsored,
      title: item.title,
      productUrl: item.productUrl,
      asinIfAvailable: item.asin,
      mainImageUrl: item.mainImageUrl,
      price: item.price,
      originalPriceOrDiscountIfVisible: item.originalPriceOrDiscount,
      rating: item.rating,
      reviewCount: item.reviewCount,
      primeOrFbaFlagIfVisible: item.primeOrFba,
      couponTextIfVisible: item.couponText,
      deliveryTextIfVisible: item.deliveryText,
      rawVisibleTextSnapshot: result.rawText,
      fieldDisclosureMap: buildFieldDisclosureMap({
        rankPosition: fieldDisclosureFromValue(item.rankPosition, "failed", "Search result rank position was not assigned."),
        isSponsored: fieldDisclosureFromValue(item.isSponsored, "failed", "Sponsored marker could not be resolved."),
        title: fieldDisclosureFromValue(item.title, "failed", "Search card title was not readable."),
        productUrl: fieldDisclosureFromValue(item.productUrl, "failed", "Search card URL was not readable."),
        asinIfAvailable: fieldDisclosureFromValue(item.asin, "not_present", "ASIN is not visible on this search card."),
        mainImageUrl: fieldDisclosureFromValue(item.mainImageUrl, "not_present", "Search card main image URL is not visible."),
        price: fieldDisclosureFromValue(item.price, "not_present", "Search card visible price is not present."),
        originalPriceOrDiscountIfVisible: fieldDisclosureFromValue(item.originalPriceOrDiscount, "not_present", "Search card original price or discount text is not visible."),
        rating: fieldDisclosureFromValue(item.rating, "not_present", "Search card rating is not visible."),
        reviewCount: fieldDisclosureFromValue(item.reviewCount, "not_present", "Search card review count is not visible."),
        primeOrFbaFlagIfVisible: fieldDisclosureFromValue(item.primeOrFba, "not_present", "Prime or FBA flag is not visible on this card."),
        couponTextIfVisible: fieldDisclosureFromValue(item.couponText, "not_present", "Coupon text is not visible on this card."),
        deliveryTextIfVisible: fieldDisclosureFromValue(item.deliveryText, "not_present", "Delivery text is not visible on this card."),
        rawVisibleTextSnapshot: fieldDisclosureFromValue(result.rawText, "failed", "Search page raw visible text snapshot is empty."),
      }),
      createdAt: now,
    }));
  },
});

export const runAmazonSearch = async (input: {
  browser?: BrowserController;
  marketplace: string;
  keywordId: string;
  keyword: string;
  taskId: string;
  adapter?: SearchPageAdapter;
}): Promise<SearchResult> => {
  const searchUrl = `https://www.${input.marketplace}/s?k=${encodeURIComponent(input.keyword)}`;

  try {
    if (!input.adapter && !input.browser) {
      throw new Error("No browser or adapter provided for Amazon search extraction");
    }
    const adapter: SearchPageAdapter = input.adapter ?? buildBrowserSearchAdapter(input.browser!, input.marketplace);
    const items = await adapter.extractSearchResults({
      keyword: input.keyword,
      keywordId: input.keywordId,
      taskId: input.taskId,
      searchUrl,
    });
    if (!Array.isArray(items)) {
      throw new Error("amazon_search_extract_invalid_items");
    }
    return { ok: true, items, searchUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("login_required")) {
      return { ok: false, blockerKind: "login_required", reason: message };
    }
    if (message.includes("captcha")) {
      return { ok: false, blockerKind: "captcha", reason: message };
    }
    if (message.includes("rate_limited")) {
      return { ok: false, blockerKind: "rate_limited", reason: message };
    }
    if (message.includes("region_restricted")) {
      return { ok: false, blockerKind: "region_restricted", reason: message };
    }
    return { ok: false, blockerKind: "page_structure_unsupported", reason: message };
  }
};
