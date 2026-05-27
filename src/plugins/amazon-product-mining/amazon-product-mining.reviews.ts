import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
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

const AMAZON_REVIEWS_EXTRACT_SCRIPT = `
return (function() {
  var loginEl = document.querySelector('#ap_email') || document.querySelector('input[name="email"]');
  if (loginEl) return { blocker: 'login_required' };
  var captchaEl = document.querySelector('#captchacharacters');
  if (captchaEl) return { blocker: 'captcha' };
  if (document.body.innerText.toLowerCase().includes('sign in to see all reviews')) {
    return { blocker: 'login_required' };
  }
  var reviewEls = document.querySelectorAll('[data-hook="review"]');
  var reviews = [];
  reviewEls.forEach(function(el) {
    var reviewIdNative = el.getAttribute('id') || null;
    var titleEl = el.querySelector('[data-hook="review-title"] span:last-child') || el.querySelector('[data-hook="review-title"]');
    var title = titleEl ? titleEl.textContent.trim() : null;
    var bodyEl = el.querySelector('[data-hook="review-body"] span') || el.querySelector('[data-hook="review-body"]');
    var body = bodyEl ? bodyEl.textContent.trim() : null;
    var ratingEl = el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') || el.querySelector('[data-hook="cmps-review-star-rating"] .a-icon-alt');
    var rating = ratingEl ? ratingEl.textContent.trim() : null;
    var dateEl = el.querySelector('[data-hook="review-date"]');
    var reviewDate = dateEl ? dateEl.textContent.trim() : null;
    var verifiedEl = el.querySelector('[data-hook="avp-badge"]');
    var verifiedPurchase = verifiedEl ? verifiedEl.textContent.includes('Verified') : null;
    var helpfulEl = el.querySelector('[data-hook="helpful-vote-statement"]');
    var helpfulCount = helpfulEl ? helpfulEl.textContent.trim() : null;
    var authorEl = el.querySelector('.a-profile-name');
    var reviewerName = authorEl ? authorEl.textContent.trim() : null;
    var variantEl = el.querySelector('[data-hook="format-strip-linkless"]') || el.querySelector('[data-hook="review-variant"]');
    var variant = variantEl ? variantEl.textContent.trim() : null;
    var rawSnap = el.textContent ? el.textContent.substring(0, 2000) : null;
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
};

type ExtractResult =
  | { blocker: string }
  | { reviews: ExtractedReview[]; hasNextPage: boolean };

const buildBrowserReviewAdapter = (browser: BrowserController): ReviewPageAdapter => ({
  async extractReviewsFromPage({ reviewsUrl, pageIndex, detailId, taskId, asin }) {
    const url = pageIndex === 0 ? reviewsUrl : `${reviewsUrl}?pageNumber=${pageIndex + 1}`;
    await browser.open({
      url,
      title: `Amazon reviews page ${pageIndex + 1}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(2500);

    const result = await browser.evaluateActiveTab<ExtractResult>({
      script: AMAZON_REVIEWS_EXTRACT_SCRIPT,
      description: `Extract Amazon reviews page index ${pageIndex}`,
    });

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
      reviewImagesIfVisible: [],
      reviewVideosIfVisible: [],
      reviewLanguage: null,
      reviewRegionIfVisible: null,
      rawReviewTextSnapshot: r.rawSnap,
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
  const maxPages = input.maxPages ?? 5;
  const adapter: ReviewPageAdapter = input.adapter ?? (input.browser
    ? buildBrowserReviewAdapter(input.browser)
    : (() => { throw new Error("No browser or adapter provided for review pagination"); })());

  let pageIndex = 0;
  let totalPagesVisited = 0;
  let totalReviewsCollected = 0;
  let finalRestriction: "manual_required" | null = null;

  while (pageIndex < maxPages) {
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
