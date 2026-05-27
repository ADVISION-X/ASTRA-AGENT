import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
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
(function() {
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
    var primeEl = card.querySelector('[aria-label="Amazon Prime"]') || card.querySelector('.s-prime');
    var primeOrFba = primeEl ? 'Prime' : null;
    var couponEl = card.querySelector('.s-coupon-unclipped span') || card.querySelector('.couponBadge');
    var couponText = couponEl ? couponEl.textContent.trim() : null;
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
    });
  });
  return { items: items, rawText: document.body.innerText.substring(0, 8000) };
})()
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
};

type ExtractResult =
  | { blocker: string }
  | { items: ExtractedItem[]; rawText: string };

const buildBrowserSearchAdapter = (browser: BrowserController, marketplace: string): SearchPageAdapter => ({
  async extractSearchResults({ keyword, keywordId, taskId }) {
    const searchUrl = `https://www.${marketplace}/s?k=${encodeURIComponent(keyword)}`;
    await browser.open({ url: searchUrl, title: `Amazon search: ${keyword}` });
    await browser.wait(3000);

    const result = await browser.evaluateActiveTab<ExtractResult>({
      script: AMAZON_SEARCH_EXTRACT_SCRIPT,
      description: `Extract Amazon search results for keyword: ${keyword}`,
    });

    if ("blocker" in result) {
      throw new Error(`amazon_search_blocked:${result.blocker}`);
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
      originalPriceOrDiscountIfVisible: null,
      rating: item.rating,
      reviewCount: item.reviewCount,
      primeOrFbaFlagIfVisible: item.primeOrFba,
      couponTextIfVisible: item.couponText,
      deliveryTextIfVisible: null,
      rawVisibleTextSnapshot: result.rawText,
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
