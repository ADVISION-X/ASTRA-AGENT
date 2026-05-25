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
(function() {
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
  var priceEl = document.querySelector('.priceToPay .a-offscreen') || document.querySelector('#priceblock_ourprice');
  var currentPrice = priceEl ? priceEl.textContent.trim() : null;
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
  var ratingEl = document.querySelector('#acrPopover .a-size-base.a-color-base');
  var rating = ratingEl ? ratingEl.textContent.trim() : null;
  var reviewCountEl = document.querySelector('#acrCustomerReviewText');
  var reviewCount = reviewCountEl ? reviewCountEl.textContent.trim() : null;
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
})()
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

const buildBrowserDetailAdapter = (browser: BrowserController): DetailPageAdapter => ({
  async extractProductDetail({ productUrl, asin, taskId }) {
    await browser.open({ url: productUrl, title: `Amazon product: ${asin}` });
    await browser.wait(2500);

    const raw = await browser.evaluateActiveTab<ExtractedDetail>({
      script: AMAZON_DETAIL_EXTRACT_SCRIPT,
      description: `Extract Amazon product detail for ASIN: ${asin}`,
    });

    const now = new Date().toISOString();
    return {
      detailId: randomUUID(),
      taskId,
      asin: raw.asin ?? asin,
      productUrl,
      title: raw.title,
      brand: raw.brand,
      sellerOrStoreIfVisible: raw.sellerOrStore,
      currentPrice: raw.currentPrice,
      originalPriceDiscountCouponIfVisible: raw.origOrCoupon,
      mainImage: raw.mainImage,
      allVisibleImages: raw.allVisibleImages,
      visibleVideoInfo: null,
      bulletPoints: raw.bulletPoints,
      aboutThisItem: raw.aboutThisItem,
      productDescription: raw.productDescription,
      aPlusContentIfVisible: null,
      variationOptions: raw.variationOptions,
      colorSizeStyleOptions: raw.colorOpts,
      productInformation: null,
      technicalDetails: raw.technicalDetails,
      additionalInformation: null,
      bestSellersRankIfVisible: raw.bestSellersRankIfVisible,
      categoryPathIfVisible: null,
      rating: raw.rating,
      reviewCount: raw.reviewCount,
      starDistribution: null,
      qaContentIfVisible: null,
      frequentlyBoughtTogetherIfVisible: null,
      customersAlsoBoughtIfVisible: null,
      compareWithSimilarItemsIfVisible: null,
      deliveryInformation: raw.deliveryInfo,
      returnInformation: null,
      allOtherVisibleProductParameters: null,
      rawVisibleTextSnapshot: raw.rawText,
      status: "pending_detail" as const,
      failureReason: null,
      createdAt: now,
      updatedAt: null,
    };
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
