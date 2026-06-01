import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  buildFieldDisclosureMap,
  fieldDisclosureFromValue,
} from "./amazon-product-mining.field-disclosure.js";
import { AMAZON_DETAIL_EXTRACT_SCRIPT as AMAZON_DETAIL_EXTRACT_SCRIPT_SOURCE } from "./amazon-product-mining.product-detail-script.js";
import type { AmazonProductDetail } from "./amazon-product-mining.schema.js";

export type DetailPageAdapter = {
  extractProductDetail(input: {
    productUrl: string;
    asin: string;
    taskId: string;
  }): Promise<AmazonProductDetail>;
};

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
  boughtInPastMonthIfVisible: string | null;
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

const DETAIL_TWISTER_REQUIRED_TOKENS = [
  "sortedDimValuesForAllDims",
  "desktop-twister-sort-filter-data",
  "dimensionValueDisplayText",
  "dimensionValueState",
  "defaultAsin",
  "pageLoadURL",
] as const;

const ensureDetailScriptSupportsTwisterState = (script: string): string => {
  for (const token of DETAIL_TWISTER_REQUIRED_TOKENS) {
    if (!script.includes(token)) {
      throw new Error(`amazon_detail_script_missing_token:${token}`);
    }
  }
  return script;
};

const AMAZON_DETAIL_EXTRACT_SCRIPT = ensureDetailScriptSupportsTwisterState(AMAZON_DETAIL_EXTRACT_SCRIPT_SOURCE);

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
  aPlusImageUrls: fieldDisclosureFromValue(raw.aPlusImageUrls ?? [], "not_present", "A+ image URLs are not visible."),
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
  boughtInPastMonthIfVisible: fieldDisclosureFromValue(raw.boughtInPastMonthIfVisible, "not_present", "Bought-in-past-month social proof is not visible."),
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
  aPlusImageUrls: raw.aPlusImageUrls ?? [],
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
  boughtInPastMonthIfVisible: raw.boughtInPastMonthIfVisible,
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
