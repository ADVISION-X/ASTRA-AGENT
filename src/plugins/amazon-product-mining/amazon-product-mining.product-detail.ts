import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  buildFieldDisclosureMap,
  fieldDisclosureFromValue,
} from "./amazon-product-mining.field-disclosure.js";
import type { AmazonProductDetail } from "./amazon-product-mining.schema.js";

export type DetailPageAdapter = {
  extractProductDetail(input: {
    productUrl: string;
    asin: string;
    taskId: string;
  }): Promise<AmazonProductDetail>;
};

const AMAZON_DETAIL_EXTRACT_SCRIPT = String.raw`
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  };
  var isVisibleElement = function(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  };
  var cleanVisibleText = function(element, maxLength) {
    if (!element || !isVisibleElement(element)) return null;
    var clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg').forEach(function(node) { node.remove(); });
    var text = normalizeText(clone.textContent || '');
    return text ? text.substring(0, maxLength) : null;
  };
  var isUsableEvidenceImageUrl = function(url) {
    if (!url) return false;
    var lower = String(url).toLowerCase();
    if (lower.indexOf('grey-pixel') >= 0) return false;
    if (lower.indexOf('transparent-pixel') >= 0) return false;
    if (lower.indexOf('default.png') >= 0) return false;
    if (lower.indexOf('base64') >= 0) return false;
    return true;
  };
  var imageCandidatesFor = function(imageEl) {
    var urls = [];
    ['data-old-hires', 'data-a-hires', 'data-src', 'data-large-image', 'src', 'currentSrc'].forEach(function(attr) {
      var value = attr === 'currentSrc' ? imageEl.currentSrc : imageEl.getAttribute(attr);
      if (value) urls.push(value);
    });
    var srcset = imageEl.getAttribute('srcset');
    if (srcset) {
      srcset.split(',').forEach(function(part) {
        var value = normalizeText(part);
        if (value) urls.push(value.split(' ')[0]);
      });
    }
    return urls.filter(isUsableEvidenceImageUrl);
  };
  var collectImageUrls = function(selectors, maxItems) {
    var urls = [];
    selectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(imageEl) {
        imageCandidatesFor(imageEl).forEach(function(url) {
          if (urls.indexOf(url) === -1) urls.push(url);
        });
      });
    });
    return urls.slice(0, maxItems);
  };
  var pickText = function(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      var text = cleanVisibleText(element, 5000);
      if (text) return text;
    }
    return null;
  };
  var pickSectionText = function(selectors, maxLength) {
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      var text = cleanVisibleText(element, maxLength);
      if (text) return text;
    }
    return null;
  };
  var collectTexts = function(selectors, maxItems) {
    var values = [];
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      nodes.forEach(function(node) {
        var text = cleanVisibleText(node, 2000);
        if (text && values.indexOf(text) === -1) values.push(text);
      });
      if (values.length >= maxItems) break;
    }
    return values.slice(0, maxItems);
  };
  var uniqueValues = function(values) {
    var out = [];
    values.forEach(function(value) {
      if (value && out.indexOf(value) === -1) out.push(value);
    });
    return out;
  };
  var serializeKeyValueRows = function(selectors) {
    var record = {};
    for (var i = 0; i < selectors.length; i++) {
      var rows = document.querySelectorAll(selectors[i]);
      rows.forEach(function(row, index) {
        var keyEl = row.querySelector('th, .a-text-bold');
        var valueEl = row.querySelector('td, span:last-child');
        var key = normalizeText(keyEl && keyEl.textContent ? keyEl.textContent : null);
        var value = normalizeText(valueEl && valueEl.textContent ? valueEl.textContent : null);
        if (!key || !value) {
          var rowText = normalizeText(row && row.textContent ? row.textContent : null);
          if (!rowText) return;
          var parts = rowText.split(/:\s+/);
          key = parts.length > 1 ? normalizeText(parts[0]) : 'item_' + String(index + 1);
          value = normalizeText(parts.length > 1 ? parts.slice(1).join(': ') : rowText);
        }
        if (key && value) record[key] = value;
      });
    }
    return Object.keys(record).length > 0 ? JSON.stringify(record) : null;
  };
  var serializeStarDistribution = function() {
    var rows = document.querySelectorAll('#histogramTable tr, [data-hook="cr-summarization-attributes"] tr, [data-hook="cr-summarization-attributes"] li, [data-hook="histogram-row-container"]');
    var items = [];
    rows.forEach(function(row) {
      var text = cleanVisibleText(row, 500);
      if (text) items.push(text);
    });
    if (items.length === 0) {
      var fallback = pickSectionText(['[data-hook="cr-summarization-attributes"]', '#cr-summarization-attributes', '#reviewsMedley'], 1500);
      if (fallback && fallback.toLowerCase().indexOf('star') >= 0) items.push(fallback);
    }
    return items.length > 0 ? JSON.stringify(items) : null;
  };

  var asin = null;
  var asinEl = document.querySelector('[name="ASIN"]');
  if (asinEl) asin = asinEl.value;
  if (!asin) {
    var asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    asin = asinMatch ? asinMatch[1] : null;
  }

  var title = pickText(['#productTitle']);
  var brand = pickText(['#bylineInfo']);
  if (brand) {
    brand = brand.replace(/Visit the|Brand:|Store/gi, '').trim() || null;
  }
  var sellerOrStore = pickText(['#merchant-info', '#tabular-buybox-seller-name']);
  var currentPrice = pickText([
    '.priceToPay .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '.a-price .a-offscreen'
  ]);
  var originalPrice = pickText(['.basisPrice .a-offscreen', '#priceblock_listprice']);
  var couponText = pickText(['#couponBadgeRegularVpc', '#couponTextpctch', '#couponText']);
  var origOrCoupon = originalPrice || couponText;

  var mainImageEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
  var mainImageCandidates = mainImageEl ? imageCandidatesFor(mainImageEl) : [];
  var mainImage = mainImageCandidates.length > 0 ? mainImageCandidates[0] : null;
  var allVisibleImages = collectImageUrls(['#altImages img[src*="images/I/"], #altImages img, #imageBlock img'], 80);
  if (mainImage && allVisibleImages.indexOf(mainImage) === -1) {
    allVisibleImages.unshift(mainImage);
  }
  var visibleVideoNodes = document.querySelectorAll('#videoBlock_feature_div video, #videoBlock_feature_div [data-video-url], #videoThumbnail_feature_div li, #altImages li.videoThumbnail, #altImages [data-video-url]');
  var visibleVideoInfo = visibleVideoNodes.length > 0 ? String(visibleVideoNodes.length) + ' visible product video slots' : null;

  var bulletPoints = collectTexts(['#feature-bullets li .a-list-item'], 30);
  var aboutThisItem = pickSectionText(['#feature-bullets'], 3000);
  var productDescription = pickSectionText(['#productDescription p', '#productDescription'], 5000);
  var aPlusContent = pickSectionText(['#aplus', '#aplus_feature_div', '[data-cel-widget*="aplus"]'], 4000);
  var aPlusImageUrls = collectImageUrls(['#aplus img, #aplus_feature_div img, [data-cel-widget*="aplus"] img'], 80);

  var variationOptions = null;
  var swatchOptions = document.querySelectorAll('.swatch-list-container .swatchElement');
  if (swatchOptions.length > 0) variationOptions = String(swatchOptions.length) + ' variants detected';
  var colorOpts = null;
  var colorOptionNodes = document.querySelectorAll('.inline-twister-swatch');
  if (colorOptionNodes.length > 0) colorOpts = String(colorOptionNodes.length) + ' color/size options';

  var productInformation = serializeKeyValueRows(['#productOverview_feature_div tr', '#poExpander tr', '#productDetails_feature_div tr', '#prodDetails tr']);
  var technicalDetails = serializeKeyValueRows(['#productDetails_techSpec_section_1 tr', '#productDetails_detailBullets_sections1 tr', '#prodDetails tr']);
  var additionalInformation = serializeKeyValueRows(['#detailBullets_feature_div li', '#detailBulletsWrapper_feature_div li', '#productDetails_detailBullets_sections1 tr']);
  var bestSellersRankIfVisible = pickSectionText(['#SalesRank', '#detailBulletsWrapper_feature_div'], 500);
  if (bestSellersRankIfVisible && bestSellersRankIfVisible.toLowerCase().indexOf('rank') === -1) {
    bestSellersRankIfVisible = null;
  }
  var categoryPathItems = collectTexts([
    '#wayfinding-breadcrumbs_feature_div li a',
    '#wayfinding-breadcrumbs_feature_div li span.a-list-item'
  ], 20);
  var categoryPath = categoryPathItems.length > 0 ? categoryPathItems.join(' > ') : null;

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
    var reviewCountMatch = ratingLabel.match(/([0-9][0-9,\.]*)\s+ratings?/i);
    reviewCount = reviewCountMatch ? '(' + reviewCountMatch[1] + ')' : null;
  }
  var starDistribution = serializeStarDistribution();
  var qaContentRaw = pickSectionText(['#ask-btf-container', '#ask_lazy_load_div', '#ask_feature_div'], 3000);
  var qaContent = qaContentRaw && (qaContentRaw.indexOf('?') >= 0 || qaContentRaw.toLowerCase().indexOf('answer') >= 0 || qaContentRaw.toLowerCase().indexOf('question') >= 0) ? qaContentRaw : null;
  var frequentlyBoughtTogether = pickSectionText(['#sims-fbt', '#bundle_feature_div', '#frequently-bought-together_feature_div'], 2000);
  var customersAlsoBought = pickSectionText(['#purchase-sims-feature', '#desktop-dp-sims_purchase-sim-feature'], 2000);
  var compareWithSimilarItems = pickSectionText(['#HLCXComparisonTable', '#similarities_feature_div', '#comparison_table_feature_div'], 2000);
  var deliveryInfo = pickText(['#availability', '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE']);
  var returnInformation = pickText([
    '#RETURNS_POLICY .a-text-bold',
    '#RETURNS_POLICY',
    '#returns-policy-anchor-text',
    '[data-feature-name="returnsPolicy"]'
  ]);
  var otherVisibleParameters = pickSectionText(['#productFactsDesktopExpander', '#prodDetails', '#detailBulletsWrapper_feature_div'], 4000);
  var rawText = cleanVisibleText(document.body, 15000) || '';

  return {
    asin: asin,
    title: title,
    brand: brand,
    sellerOrStore: sellerOrStore,
    currentPrice: currentPrice,
    origOrCoupon: origOrCoupon,
    mainImage: mainImage,
    allVisibleImages: allVisibleImages,
    visibleVideoInfo: visibleVideoInfo,
    bulletPoints: bulletPoints,
    aboutThisItem: aboutThisItem,
    productDescription: productDescription,
    aPlusContent: aPlusContent,
    aPlusImageUrls: aPlusImageUrls,
    variationOptions: variationOptions,
    colorOpts: colorOpts,
    productInformation: productInformation,
    technicalDetails: technicalDetails,
    additionalInformation: additionalInformation,
    bestSellersRankIfVisible: bestSellersRankIfVisible,
    categoryPath: categoryPath,
    rating: rating,
    reviewCount: reviewCount,
    starDistribution: starDistribution,
    qaContent: qaContent,
    frequentlyBoughtTogether: frequentlyBoughtTogether,
    customersAlsoBought: customersAlsoBought,
    compareWithSimilarItems: compareWithSimilarItems,
    deliveryInfo: deliveryInfo,
    returnInformation: returnInformation,
    otherVisibleParameters: otherVisibleParameters,
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
  visibleVideoInfo: string | null;
  bulletPoints: string[];
  aboutThisItem: string | null;
  productDescription: string | null;
  aPlusContent: string | null;
  aPlusImageUrls: string[];
  variationOptions: string | null;
  colorOpts: string | null;
  productInformation: string | null;
  technicalDetails: string | null;
  additionalInformation: string | null;
  bestSellersRankIfVisible: string | null;
  categoryPath: string | null;
  rating: string | null;
  reviewCount: string | null;
  starDistribution: string | null;
  qaContent: string | null;
  frequentlyBoughtTogether: string | null;
  customersAlsoBought: string | null;
  compareWithSimilarItems: string | null;
  deliveryInfo: string | null;
  returnInformation: string | null;
  otherVisibleParameters: string | null;
  rawText: string;
};

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

const buildIdentityDisclosure = (input: { raw: ExtractedDetail; asin: string }) => ({
  asin: fieldDisclosureFromValue(input.raw.asin ?? input.asin, "failed", "ASIN is not visible in page DOM or URL."),
  title: fieldDisclosureFromValue(input.raw.title, "failed", "Product title is not visible."),
  brand: fieldDisclosureFromValue(input.raw.brand, "not_present", "Brand text is not visible."),
  sellerOrStoreIfVisible: fieldDisclosureFromValue(input.raw.sellerOrStore, "not_present", "Seller or store text is not visible."),
  currentPrice: fieldDisclosureFromValue(input.raw.currentPrice, "not_present", "Current price is not visible."),
  originalPriceDiscountCouponIfVisible: fieldDisclosureFromValue(input.raw.origOrCoupon, "not_present", "Original price, discount, or coupon text is not visible."),
});

const buildContentDisclosure = (raw: ExtractedDetail) => ({
  mainImage: fieldDisclosureFromValue(raw.mainImage, "not_present", "Main image URL is not visible."),
  allVisibleImages: fieldDisclosureFromValue(raw.allVisibleImages, "not_present", "Visible gallery images are not present."),
  visibleVideoInfo: fieldDisclosureFromValue(raw.visibleVideoInfo, "not_present", "Visible product video module is not present."),
  bulletPoints: fieldDisclosureFromValue(raw.bulletPoints, "not_present", "Bullet points are not visible."),
  aboutThisItem: fieldDisclosureFromValue(raw.aboutThisItem, "not_present", "About this item section is not visible."),
  productDescription: fieldDisclosureFromValue(raw.productDescription, "not_present", "Product description section is not visible."),
  aPlusContentIfVisible: fieldDisclosureFromValue(raw.aPlusContent, "not_present", "A+ content module is not visible."),
  aPlusImageUrls: fieldDisclosureFromValue(raw.aPlusImageUrls, "not_present", "A+ image URLs are not visible."),
  variationOptions: fieldDisclosureFromValue(raw.variationOptions, "not_present", "Variation module is not visible."),
  colorSizeStyleOptions: fieldDisclosureFromValue(raw.colorOpts, "not_present", "Color/size/style module is not visible."),
});

const buildCommerceDisclosure = (raw: ExtractedDetail) => ({
  productInformation: fieldDisclosureFromValue(raw.productInformation, "not_present", "Product information section is not visible."),
  technicalDetails: fieldDisclosureFromValue(raw.technicalDetails, "not_present", "Technical details section is not visible."),
  additionalInformation: fieldDisclosureFromValue(raw.additionalInformation, "not_present", "Additional information section is not visible."),
  bestSellersRankIfVisible: fieldDisclosureFromValue(raw.bestSellersRankIfVisible, "not_present", "Best sellers rank is not visible."),
  categoryPathIfVisible: fieldDisclosureFromValue(raw.categoryPath, "not_present", "Category breadcrumb is not visible."),
  rating: fieldDisclosureFromValue(raw.rating, "not_present", "Product rating is not visible."),
  reviewCount: fieldDisclosureFromValue(raw.reviewCount, "not_present", "Review count is not visible."),
  starDistribution: fieldDisclosureFromValue(raw.starDistribution, "not_present", "Star distribution is not visible."),
  qaContentIfVisible: fieldDisclosureFromValue(raw.qaContent, "not_present", "Q&A section is not visible."),
  frequentlyBoughtTogetherIfVisible: fieldDisclosureFromValue(raw.frequentlyBoughtTogether, "not_present", "Frequently bought together module is not visible."),
  customersAlsoBoughtIfVisible: fieldDisclosureFromValue(raw.customersAlsoBought, "not_present", "Customers also bought module is not visible."),
  compareWithSimilarItemsIfVisible: fieldDisclosureFromValue(raw.compareWithSimilarItems, "not_present", "Compare with similar items module is not visible."),
  deliveryInformation: fieldDisclosureFromValue(raw.deliveryInfo, "not_present", "Delivery information is not visible."),
  returnInformation: fieldDisclosureFromValue(raw.returnInformation, "not_present", "Return information is not visible."),
  allOtherVisibleProductParameters: fieldDisclosureFromValue(raw.otherVisibleParameters, "not_present", "Other visible product parameter sections are not visible."),
});

const buildProductIdentity = (input: {
  raw: ExtractedDetail;
  asin: string;
  productUrl: string;
  taskId: string;
}) => ({
  detailId: randomUUID(),
  taskId: input.taskId,
  asin: input.raw.asin ?? input.asin,
  productUrl: input.productUrl,
  title: input.raw.title,
  brand: input.raw.brand,
  sellerOrStoreIfVisible: input.raw.sellerOrStore,
  currentPrice: input.raw.currentPrice,
  originalPriceDiscountCouponIfVisible: input.raw.origOrCoupon,
});

const buildProductContent = (raw: ExtractedDetail) => ({
  mainImage: raw.mainImage,
  allVisibleImages: raw.allVisibleImages,
  visibleVideoInfo: raw.visibleVideoInfo,
  bulletPoints: raw.bulletPoints,
  aboutThisItem: raw.aboutThisItem,
  productDescription: raw.productDescription,
  aPlusContentIfVisible: raw.aPlusContent,
  aPlusImageUrls: raw.aPlusImageUrls,
  variationOptions: raw.variationOptions,
  colorSizeStyleOptions: raw.colorOpts,
});

const buildProductCommerce = (raw: ExtractedDetail) => ({
  productInformation: raw.productInformation,
  technicalDetails: raw.technicalDetails,
  additionalInformation: raw.additionalInformation,
  bestSellersRankIfVisible: raw.bestSellersRankIfVisible,
  categoryPathIfVisible: raw.categoryPath,
  rating: raw.rating,
  reviewCount: raw.reviewCount,
  starDistribution: raw.starDistribution,
  qaContentIfVisible: raw.qaContent,
  frequentlyBoughtTogetherIfVisible: raw.frequentlyBoughtTogether,
  customersAlsoBoughtIfVisible: raw.customersAlsoBought,
  compareWithSimilarItemsIfVisible: raw.compareWithSimilarItems,
  deliveryInformation: raw.deliveryInfo,
  returnInformation: raw.returnInformation,
  allOtherVisibleProductParameters: raw.otherVisibleParameters,
});

const buildProductStatus = (input: {
  raw: ExtractedDetail;
  asin: string;
  createdAt: string;
}) => ({
  rawVisibleTextSnapshot: input.raw.rawText,
  fieldDisclosureMap: buildFieldDisclosureMap({
    ...buildIdentityDisclosure({ raw: input.raw, asin: input.asin }),
    ...buildContentDisclosure(input.raw),
    ...buildCommerceDisclosure(input.raw),
    rawVisibleTextSnapshot: fieldDisclosureFromValue(input.raw.rawText, "failed", "Detail page raw visible text snapshot is empty."),
  }),
  status: "pending_detail" as const,
  failureReason: null,
  createdAt: input.createdAt,
  updatedAt: null,
});

const buildProductDetailRecord = (input: {
  raw: ExtractedDetail;
  asin: string;
  productUrl: string;
  taskId: string;
  createdAt: string;
}): AmazonProductDetail => ({
  ...buildProductIdentity(input),
  ...buildProductContent(input.raw),
  ...buildProductCommerce(input.raw),
  ...buildProductStatus({ raw: input.raw, asin: input.asin, createdAt: input.createdAt }),
});

const buildBrowserDetailAdapter = (browser: BrowserController): DetailPageAdapter => ({
  async extractProductDetail({ productUrl, asin, taskId }) {
    await browser.open({
      url: productUrl,
      title: `Amazon product: ${asin}`,
      reusePolicy: "reuse-active-tab",
    });
    await browser.wait(1500);

    const raw = await extractActiveTabJson<ExtractedDetail>(
      browser,
      AMAZON_DETAIL_EXTRACT_SCRIPT,
      `Amazon product detail extraction for ${asin}`,
      "amazon_detail_extract_failed",
    );

    return buildProductDetailRecord({
      raw,
      asin,
      productUrl,
      taskId,
      createdAt: new Date().toISOString(),
    });
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
