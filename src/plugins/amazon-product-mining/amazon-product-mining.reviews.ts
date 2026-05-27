import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  buildFieldDisclosureMap,
  fieldDisclosureFromValue,
} from "./amazon-product-mining.field-disclosure.js";
import type { AmazonReviewRecord } from "./amazon-product-mining.schema.js";

export type ReviewPageAdapter = {
  extractReviewsFromPage(input: {
    reviewsUrl: string;
    pageIndex: number;
    detailId: string;
    taskId: string;
    asin: string | null;
  }): Promise<{
    reviews: AmazonReviewRecord[];
    hasNextPage: boolean;
    restriction: "manual_required" | null;
  }>;
};

const AMAZON_REVIEWS_EXTRACT_SCRIPT = String.raw`
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  };
  var cleanVisibleText = function(element, maxLength) {
    if (!element) return null;
    var clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg').forEach(function(node) { node.remove(); });
    var text = normalizeText(clone.textContent || '');
    return text ? text.substring(0, maxLength) : null;
  };
  var isEvidenceMediaUrl = function(url) {
    if (!url) return false;
    var lower = String(url).toLowerCase();
    if (lower.indexOf('grey-pixel') >= 0) return false;
    if (lower.indexOf('transparent-pixel') >= 0) return false;
    if (lower.indexOf('amazon-avatars') >= 0) return false;
    if (lower.indexOf('default.png') >= 0) return false;
    if (lower.indexOf('base64') >= 0) return false;
    return true;
  };
  var firstText = function(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var node = root.querySelector(selectors[i]);
      var text = cleanVisibleText(node, 2000);
      if (text) return text;
    }
    return null;
  };
  var hasArabicText = function(text) {
    if (!text) return false;
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if ((code >= 1536 && code <= 1791) || (code >= 1872 && code <= 1919) || (code >= 64336 && code <= 65023)) {
        return true;
      }
    }
    return false;
  };
  var detectReviewLanguage = function(root, fallbackLanguage, title, body) {
    var explicit = root.querySelector('[lang]');
    var lang = explicit ? explicit.getAttribute('lang') : null;
    if (lang) return lang;
    if (hasArabicText((title || '') + ' ' + (body || ''))) return 'ar';
    return fallbackLanguage;
  };
  var extractReviewRegion = function(dateText) {
    if (!dateText) return null;
    var marker = 'Reviewed in ';
    var start = dateText.indexOf(marker);
    if (start < 0) return null;
    var afterMarker = dateText.substring(start + marker.length);
    var onIndex = afterMarker.indexOf(' on ');
    return onIndex >= 0 ? normalizeText(afterMarker.substring(0, onIndex)) : normalizeText(afterMarker);
  };
  var loginEl = document.querySelector('#ap_email') || document.querySelector('input[name="email"]');
  if (loginEl) return { blocker: 'login_required' };
  var captchaEl = document.querySelector('#captchacharacters');
  if (captchaEl) return { blocker: 'captcha' };
  if (document.body.innerText.toLowerCase().includes('sign in to see all reviews')) {
    return { blocker: 'login_required' };
  }
  var reviewEls = document.querySelectorAll('[data-hook="review"]');
  var reviews = [];
  var pageLanguage = document.documentElement.getAttribute('lang') || null;
  reviewEls.forEach(function(el) {
    var reviewIdNative = el.getAttribute('id') || null;
    var titleEl = el.querySelector('[data-hook="review-title"] span:last-child') || el.querySelector('[data-hook="review-title"]');
    var title = cleanVisibleText(titleEl, 1000);
    var bodyEl = el.querySelector('[data-hook="review-body"] span') || el.querySelector('[data-hook="review-body"]');
    var body = cleanVisibleText(bodyEl, 4000);
    var ratingEl = el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') || el.querySelector('[data-hook="cmps-review-star-rating"] .a-icon-alt');
    var rating = cleanVisibleText(ratingEl, 500);
    var dateEl = el.querySelector('[data-hook="review-date"]');
    var reviewDate = cleanVisibleText(dateEl, 500);
    var verifiedEl = el.querySelector('[data-hook="avp-badge"]');
    var verifiedText = cleanVisibleText(verifiedEl, 500);
    var verifiedPurchase = verifiedText ? verifiedText.toLowerCase().indexOf('verified') >= 0 : null;
    var helpfulEl = el.querySelector('[data-hook="helpful-vote-statement"]');
    var helpfulCount = cleanVisibleText(helpfulEl, 500);
    var authorEl = el.querySelector('.a-profile-name');
    var reviewerName = cleanVisibleText(authorEl, 500);
    var variantEl = el.querySelector('[data-hook="format-strip-linkless"]') || el.querySelector('[data-hook="review-variant"]');
    var variant = cleanVisibleText(variantEl, 500);
    var reviewRegion = extractReviewRegion(reviewDate || '');
    var reviewImages = Array.from(el.querySelectorAll('[data-hook="review-image-tile"] img, .review-image-tile-section img'))
      .map(function(imageEl) { return imageEl.getAttribute('data-src') || imageEl.getAttribute('src') || imageEl.currentSrc; })
      .filter(isEvidenceMediaUrl);
    var reviewVideos = Array.from(el.querySelectorAll('[data-hook="video-block"] a, [data-hook="review-video-thumbnail"] a, a[href*="media_gallery"]'))
      .map(function(videoEl) { return videoEl.getAttribute('href') || videoEl.getAttribute('data-video-url') || videoEl.getAttribute('src'); })
      .filter(isEvidenceMediaUrl);
    var rawSnap = cleanVisibleText(el, 2000);
    var reviewLanguage = detectReviewLanguage(el, pageLanguage, title, body);
    reviews.push({
      reviewIdNative: reviewIdNative,
      title: title,
      body: body,
      rating: rating,
      reviewDate: reviewDate,
      verifiedPurchase: verifiedPurchase,
      helpfulCount: helpfulCount,
      reviewerName: reviewerName,
      variant: variant,
      reviewImages: reviewImages,
      reviewVideos: reviewVideos,
      reviewLanguage: reviewLanguage,
      reviewRegion: reviewRegion,
      rawSnap: rawSnap,
    });
  });
  var nextPageEl = document.querySelector('li.a-last:not(.a-disabled) a') || document.querySelector('[data-hook="pagination-bar"] .a-last:not(.a-disabled) a');
  var hasNextPage = !!nextPageEl;
  return { reviews: reviews, hasNextPage: hasNextPage };
})();
`;

type ExtractedReview = {
  reviewIdNative: string | null;
  title: string | null;
  body: string | null;
  rating: string | null;
  reviewDate: string | null;
  verifiedPurchase: boolean | null;
  helpfulCount: string | null;
  reviewerName: string | null;
  variant: string | null;
  rawSnap: string | null;
  reviewImages: string[];
  reviewVideos: string[];
  reviewLanguage: string | null;
  reviewRegion: string | null;
};

type ExtractResult =
  | { blocker: string }
  | { reviews: ExtractedReview[]; hasNextPage: boolean };
const extractActiveTabJson = async <T>(
  browser: BrowserController,
  script: string,
  description: string,
  errorCode: string,
): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await browser.evaluateActiveTab<T>({ script, description });
    } catch (error) {
      lastError = error;
      await browser.wait(750);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${errorCode}:${message}`);
};

export const buildReviewPageUrl = (reviewsUrl: string, pageIndex: number): string => {
  if (pageIndex === 0) {
    return reviewsUrl;
  }
  const url = new URL(reviewsUrl);
  url.searchParams.set("pageNumber", String(pageIndex + 1));
  return url.toString();
};

const buildBrowserReviewAdapter = (browser: BrowserController): ReviewPageAdapter => ({
  async extractReviewsFromPage({ reviewsUrl, pageIndex, detailId, taskId, asin }) {
    const url = buildReviewPageUrl(reviewsUrl, pageIndex);
    await browser.open({
      url,
      title: `Amazon reviews page ${pageIndex + 1}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(1500);

    const result = await extractActiveTabJson<ExtractResult>(
      browser,
      AMAZON_REVIEWS_EXTRACT_SCRIPT,
      `Amazon review page extraction for page ${pageIndex + 1}`,
      "amazon_review_extract_failed",
    );

    if ("blocker" in result) {
      return { reviews: [], hasNextPage: false, restriction: "manual_required" };
    }

    const now = new Date().toISOString();
    const records: AmazonReviewRecord[] = result.reviews.map((r) => ({
      reviewId: randomUUID(),
      detailId,
      taskId,
      asin,
      pageIndex,
      reviewIdIfAvailable: r.reviewIdNative,
      reviewerName: r.reviewerName,
      rating: r.rating,
      reviewTitle: r.title,
      reviewBody: r.body,
      reviewDate: r.reviewDate,
      verifiedPurchase: r.verifiedPurchase,
      variant: r.variant,
      helpfulCountIfVisible: r.helpfulCount,
      reviewImagesIfVisible: r.reviewImages,
      reviewVideosIfVisible: r.reviewVideos,
      reviewLanguage: r.reviewLanguage,
      reviewRegionIfVisible: r.reviewRegion,
      rawReviewTextSnapshot: r.rawSnap,
      fieldDisclosureMap: buildFieldDisclosureMap({
        reviewIdIfAvailable: fieldDisclosureFromValue(r.reviewIdNative, "not_present", "Amazon review id is not visible on this review card."),
        reviewerName: fieldDisclosureFromValue(r.reviewerName, "failed", "Reviewer name is not visible."),
        rating: fieldDisclosureFromValue(r.rating, "failed", "Review rating is not visible."),
        reviewTitle: fieldDisclosureFromValue(r.title, "not_present", "Review title is not visible."),
        reviewBody: fieldDisclosureFromValue(r.body, "not_present", "Review body is not visible."),
        reviewDate: fieldDisclosureFromValue(r.reviewDate, "failed", "Review date is not visible."),
        verifiedPurchase: fieldDisclosureFromValue(r.verifiedPurchase, "not_present", "Verified purchase badge is not visible."),
        variant: fieldDisclosureFromValue(r.variant, "not_present", "Review variant text is not visible."),
        helpfulCountIfVisible: fieldDisclosureFromValue(r.helpfulCount, "not_present", "Helpful count is not visible."),
        reviewImagesIfVisible: fieldDisclosureFromValue(r.reviewImages, "not_present", "No review images are visible for this review."),
        reviewVideosIfVisible: fieldDisclosureFromValue(r.reviewVideos, "not_present", "No review videos are visible for this review."),
        reviewLanguage: fieldDisclosureFromValue(r.reviewLanguage, "not_present", "Review language is not visible from page locale or review metadata."),
        reviewRegionIfVisible: fieldDisclosureFromValue(r.reviewRegion, "not_present", "Review region is not visible in review metadata."),
        rawReviewTextSnapshot: fieldDisclosureFromValue(r.rawSnap, "failed", "Review raw text snapshot is empty."),
      }),
      createdAt: now,
    }));

    return { reviews: records, hasNextPage: result.hasNextPage, restriction: null };
  },
});

export type ReviewPaginationResult = {
  totalReviewsCollected: number;
  totalPagesVisited: number;
  restriction: "manual_required" | null;
};

export const runReviewPagination = async (input: {
  browser?: BrowserController;
  reviewsUrl: string;
  detailId: string;
  taskId: string;
  asin: string | null;
  maxPages?: number;
  adapter?: ReviewPageAdapter;
  onPageExtracted: (reviews: AmazonReviewRecord[], pageIndex: number) => Promise<void>;
}): Promise<ReviewPaginationResult> => {
  const hardLimitPages = input.maxPages;
  const safetyLimitPages = 50;
  const adapter: ReviewPageAdapter = input.adapter ?? (input.browser
    ? buildBrowserReviewAdapter(input.browser)
    : (() => { throw new Error("No browser or adapter provided for review pagination"); })());

  let pageIndex = 0;
  let totalPagesVisited = 0;
  let totalReviewsCollected = 0;
  let finalRestriction: "manual_required" | null = null;

  while (pageIndex < safetyLimitPages && (hardLimitPages === undefined || pageIndex < hardLimitPages)) {
    const { reviews, hasNextPage, restriction } = await adapter.extractReviewsFromPage({
      reviewsUrl: input.reviewsUrl,
      pageIndex,
      detailId: input.detailId,
      taskId: input.taskId,
      asin: input.asin,
    });

    // Persist reviews per page INSIDE pagination loop (law 007)
    await input.onPageExtracted(reviews, pageIndex);
    totalPagesVisited++;
    totalReviewsCollected += reviews.length;

    if (restriction === "manual_required") {
      finalRestriction = "manual_required";
      break;
    }

    if (!hasNextPage) break;
    pageIndex++;
  }

  return {
    totalReviewsCollected,
    totalPagesVisited,
    restriction: finalRestriction,
  };
};
