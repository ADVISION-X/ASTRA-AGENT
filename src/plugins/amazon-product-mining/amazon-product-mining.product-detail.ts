import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { AmazonProductDetail } from "./amazon-product-mining.schema.js";

export type DetailPageAdapter = {
  extractProductDetail(input: {
    productUrl: string;
    asin: string;
    taskId: string;
  }): Promise<AmazonProductDetail>;
};

const AMAZON_DETAIL_EXTRACT_SCRIPT = `
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text
      .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  var pickText = function(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      var text = element && element.textContent ? normalizeText(element.textContent) : null;
      if (text) return text;
    }
    return null;
  };
  var asin = null;
  var asinEl = document.querySelector('[name="ASIN"]');
  if (asinEl) asin = asinEl.value;
  if (!asin) {
    var m = window.location.pathname.match(/\\/dp\\/([A-Z0-9]{10})/);
    asin = m ? m[1] : null;
  }
  var titleEl = document.getElementById('productTitle');
  var title = titleEl ? titleEl.textContent.trim() : null;
  var brandEl = document.getElementById('bylineInfo');
  var brand = brandEl ? brandEl.textContent.replace(/Visit the|Brand:|Store/g, '').trim() : null;
  var currentPrice = pickText([
    '.priceToPay .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '.a-price .a-offscreen'
  ]);
  var origEl = document.querySelector('.basisPrice .a-offscreen') || document.querySelector('#priceblock_listprice');
  var couponEl = document.querySelector('#couponBadgeRegularVpc');
  var origOrCoupon = null;
  if (origEl) origOrCoupon = origEl.textContent.trim();
  else if (couponEl) origOrCoupon = couponEl.textContent.trim();
  var imgEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
  var mainImage = imgEl ? (imgEl.getAttribute('data-old-hires') || imgEl.getAttribute('src')) : null;
  var allImgEls = document.querySelectorAll('#altImages img[src*="images/I/"]');
  var allVisibleImages = Array.from(allImgEls).map(function(el) { return el.getAttribute('src'); }).filter(Boolean);
  var bulletEls = document.querySelectorAll('#feature-bullets li .a-list-item');
  var bulletPoints = Array.from(bulletEls).map(function(el) { return el.textContent.trim(); }).filter(Boolean);
  var aboutEl = document.querySelector('#feature-bullets');
  var aboutThisItem = aboutEl ? aboutEl.textContent.trim().substring(0, 3000) : null;
  var descEl = document.querySelector('#productDescription p') || document.getElementById('productDescription');
  var productDescription = descEl ? descEl.textContent.trim().substring(0, 5000) : null;
  var techRows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
  var techObj = {};
  techRows.forEach(function(row) {
    var th = row.querySelector('th'); var td = row.querySelector('td');
    if (th && td) techObj[th.textContent.trim()] = td.textContent.trim();
  });
  var technicalDetails = Object.keys(techObj).length ? JSON.stringify(techObj) : null;
  var bsrEl = document.querySelector('#SalesRank, #detailBulletsWrapper_feature_div');
  var bestSellersRankIfVisible = null;
  if (bsrEl && bsrEl.textContent.toLowerCase().includes('rank')) {
    bestSellersRankIfVisible = bsrEl.textContent.substring(0, 500);
  }
  var ratingLabel = pickText([
    '#acrPopover .a-size-base.a-color-base',
    '#acrPopover .a-icon-alt',
    '[data-hook="rating-out-of-text"]',
    '[data-hook="average-star-rating"] .a-icon-alt'
  ]);
  if (!ratingLabel) {
    var ariaRatingEl = document.querySelector('[aria-label*="out of 5 stars"]');
    ratingLabel = ariaRatingEl ? normalizeText(ariaRatingEl.getAttribute('aria-label')) : null;
  }
  var ratingMatch = ratingLabel ? ratingLabel.match(/([0-9]+(?:[\.,][0-9]+)?)\s*out of 5 stars/i) : null;
  var rating = ratingMatch ? ratingMatch[1] + ' out of 5 stars' : ratingLabel;
  var reviewCount = pickText([
    '#acrCustomerReviewText',
    '[data-hook="total-review-count"]',
    'a[data-hook="see-all-reviews-link-foot"]'
  ]);
  if (!reviewCount && ratingLabel) {
    var trailingRatingText = ratingMatch
      ? normalizeText(ratingLabel.slice(ratingLabel.indexOf(ratingMatch[0]) + ratingMatch[0].length))
      : ratingLabel;
    var reviewCountMatch = trailingRatingText
      ? trailingRatingText.match(/([0-9][0-9,\.]*)\s+ratings?/i)
      : null;
    if (!reviewCountMatch) {
      reviewCountMatch = ratingLabel.match(/([0-9][0-9,\.]*)\s+ratings?/i);
    }
    reviewCount = reviewCountMatch ? '(' + reviewCountMatch[1] + ')' : null;
  }
  var sellerEl = document.getElementById('merchant-info') || document.getElementById('tabular-buybox-seller-name');
  var sellerOrStore = sellerEl ? sellerEl.textContent.trim().substring(0, 200) : null;
  var stockEl = document.getElementById('availability');
  var deliveryInfo = stockEl ? stockEl.textContent.trim() : null;
  var variantEls = document.querySelectorAll('.swatch-list-container .swatchElement');
  var variationOptions = variantEls.length > 0 ? (variantEls.length + ' variants detected') : null;
  var colorEls = document.querySelectorAll('.inline-twister-swatch');
  var colorOpts = colorEls.length > 0 ? (colorEls.length + ' color/size options') : null;
  var rawText = document.body.innerText.substring(0, 15000);
  return {
    asin: asin,
    title: title,
    brand: brand,
    sellerOrStore: sellerOrStore,
    currentPrice: currentPrice,
    origOrCoupon: origOrCoupon,
    mainImage: mainImage,
    allVisibleImages: allVisibleImages,
    bulletPoints: bulletPoints,
    aboutThisItem: aboutThisItem,
    productDescription: productDescription,
    technicalDetails: technicalDetails,
    bestSellersRankIfVisible: bestSellersRankIfVisible,
    rating: rating,
    reviewCount: reviewCount,
    deliveryInfo: deliveryInfo,
    variationOptions: variationOptions,
    colorOpts: colorOpts,
    rawText: rawText,
  };
})();
`;

type ExtractedDetail = {
  asin: string | null;
  title: string | null;
  brand: string | null;
  sellerOrStore: string | null;
  currentPrice: string | null;
  origOrCoupon: string | null;
  mainImage: string | null;
  allVisibleImages: string[];
  bulletPoints: string[];
  aboutThisItem: string | null;
  productDescription: string | null;
  technicalDetails: string | null;
  bestSellersRankIfVisible: string | null;
  rating: string | null;
  reviewCount: string | null;
  deliveryInfo: string | null;
  variationOptions: string | null;
  colorOpts: string | null;
  rawText: string;
};

const buildProductDetailRecord = (input: {
  raw: ExtractedDetail;
  asin: string;
  productUrl: string;
  taskId: string;
  createdAt: string;
}): AmazonProductDetail => {
  const identity = {
    detailId: randomUUID(),
    taskId: input.taskId,
    asin: input.raw.asin ?? input.asin,
    productUrl: input.productUrl,
    title: input.raw.title,
    brand: input.raw.brand,
    sellerOrStoreIfVisible: input.raw.sellerOrStore,
    currentPrice: input.raw.currentPrice,
    originalPriceDiscountCouponIfVisible: input.raw.origOrCoupon,
  };

  const content = {
    mainImage: input.raw.mainImage,
    allVisibleImages: input.raw.allVisibleImages,
    visibleVideoInfo: null,
    bulletPoints: input.raw.bulletPoints,
    aboutThisItem: input.raw.aboutThisItem,
    productDescription: input.raw.productDescription,
    aPlusContentIfVisible: null,
    variationOptions: input.raw.variationOptions,
    colorSizeStyleOptions: input.raw.colorOpts,
  };

  const commerce = {
    productInformation: null,
    technicalDetails: input.raw.technicalDetails,
    additionalInformation: null,
    bestSellersRankIfVisible: input.raw.bestSellersRankIfVisible,
    categoryPathIfVisible: null,
    rating: input.raw.rating,
    reviewCount: input.raw.reviewCount,
    starDistribution: null,
    qaContentIfVisible: null,
    frequentlyBoughtTogetherIfVisible: null,
    customersAlsoBoughtIfVisible: null,
    compareWithSimilarItemsIfVisible: null,
    deliveryInformation: input.raw.deliveryInfo,
    returnInformation: null,
    allOtherVisibleProductParameters: null,
  };

  const status = {
    rawVisibleTextSnapshot: input.raw.rawText,
    status: "pending_detail" as const,
    failureReason: null,
    createdAt: input.createdAt,
    updatedAt: null,
  };

  return {
    ...identity,
    ...content,
    ...commerce,
    ...status,
  };
};

const buildBrowserDetailAdapter = (browser: BrowserController): DetailPageAdapter => ({
  async extractProductDetail({ productUrl, asin, taskId }) {
    await browser.open({
      url: productUrl,
      title: `Amazon product: ${asin}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(2500);

    const raw = await browser.evaluateActiveTab<ExtractedDetail>({
      script: AMAZON_DETAIL_EXTRACT_SCRIPT,
      description: `Extract Amazon product detail for ASIN: ${asin}`,
    });

    const now = new Date().toISOString();
    return buildProductDetailRecord({ raw, asin, productUrl, taskId, createdAt: now });
  },
});

export const runProductDetailExtraction = async (input: {
  browser?: BrowserController;
  productUrl: string;
  asin: string;
  taskId: string;
  adapter?: DetailPageAdapter;
}): Promise<AmazonProductDetail> => {
  const adapter: DetailPageAdapter = input.adapter ?? (input.browser
    ? buildBrowserDetailAdapter(input.browser)
    : (() => { throw new Error("No browser or adapter provided for product detail extraction"); })());

  return adapter.extractProductDetail({
    productUrl: input.productUrl,
    asin: input.asin,
    taskId: input.taskId,
  });
};
