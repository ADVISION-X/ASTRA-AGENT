import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { runJxa } from "../../lib/browser/current-chrome-window-control.js";
import {
  buildFieldDisclosureMap,
  fieldDisclosureFromValue,
} from "./amazon-product-mining.field-disclosure.js";
import { buildAmazonSearchExtractScript } from "./amazon-product-mining.search-extract-script.js";
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
  | { items: ExtractedItem[]; rawText: string | null; totalCards?: number };

const buildChromeFrontTabJsonEvaluation = (script: string): string => `
const chrome = Application("Google Chrome");
chrome.activate();
const windows = chrome.windows();
if (windows.length === 0) {
  throw new Error("chrome_window_missing");
}
const frontWindow = windows[0];
const tab = frontWindow.activeTab();
const value = tab.execute({ javascript: ${JSON.stringify(`JSON.stringify((function() { ${script} })())`)} });
if (value === undefined || value === null || value === "" || value === "missing value") {
  throw new Error("amazon_search_extract_empty_result");
}
String(value);
`;

const evaluateSearchResultSlice = async (input: {
  keyword: string;
  startIndex: number;
}): Promise<{ items: ExtractedItem[]; rawText: string | null; totalCards: number }> => {
  const rawResult = await runJxa(
    buildChromeFrontTabJsonEvaluation(
      buildAmazonSearchExtractScript({
        includeRawText: input.startIndex === 0,
        limit: 10,
        startIndex: input.startIndex,
      }),
    ),
  );
  const result = JSON.parse(rawResult) as ExtractResult;

  if (!result || typeof result !== "object") {
    throw new Error("amazon_search_extract_invalid_result");
  }
  if ("blocker" in result) {
    throw new Error(`amazon_search_blocked:${result.blocker}`);
  }
  if (!Array.isArray(result.items)) {
    throw new Error("amazon_search_extract_invalid_items");
  }

  return {
    items: result.items,
    rawText: result.rawText ?? null,
    totalCards: typeof result.totalCards === "number" ? result.totalCards : input.startIndex + result.items.length,
  };
};

const collectBrowserSearchItems = async (input: {
  keyword: string;
}): Promise<{ extractedItems: ExtractedItem[]; rawVisibleTextSnapshot: string }> => {
  const extractedItems: ExtractedItem[] = [];
  let rawVisibleTextSnapshot = "";
  let totalCards: number | null = null;

  for (let startIndex = 0; totalCards === null || startIndex < totalCards; startIndex += 10) {
    const result = await evaluateSearchResultSlice({
      keyword: input.keyword,
      startIndex,
    });
    if (startIndex === 0) {
      rawVisibleTextSnapshot = result.rawText ?? "";
    }
    totalCards = result.totalCards;
    extractedItems.push(...result.items);
    if (result.items.length === 0) {
      break;
    }
  }

  return { extractedItems, rawVisibleTextSnapshot };
};

const mapExtractedSearchItems = (input: {
  extractedItems: readonly ExtractedItem[];
  keyword: string;
  keywordId: string;
  rawVisibleTextSnapshot: string;
  searchUrl: string;
  taskId: string;
}): AmazonSearchResultItem[] => {
  const now = new Date().toISOString();
  return input.extractedItems.map((item) => ({
    itemId: randomUUID(),
    keywordId: input.keywordId,
    taskId: input.taskId,
    keyword: input.keyword,
    searchUrl: input.searchUrl,
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
    rawVisibleTextSnapshot: input.rawVisibleTextSnapshot,
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
      rawVisibleTextSnapshot: fieldDisclosureFromValue(input.rawVisibleTextSnapshot, "failed", "Search page raw visible text snapshot is empty."),
    }),
    createdAt: now,
  }));
};

const buildBrowserSearchAdapter = (browser: BrowserController, marketplace: string): SearchPageAdapter => ({
  async extractSearchResults({ keyword, keywordId, taskId }) {
    const searchUrl = `https://www.${marketplace}/s?k=${encodeURIComponent(keyword)}`;
    await browser.open({
      url: searchUrl,
      title: `Amazon search: ${keyword}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(3000);

    const { extractedItems, rawVisibleTextSnapshot } = await collectBrowserSearchItems({ keyword });
    return mapExtractedSearchItems({
      extractedItems,
      keyword,
      keywordId,
      rawVisibleTextSnapshot,
      searchUrl,
      taskId,
    });
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
