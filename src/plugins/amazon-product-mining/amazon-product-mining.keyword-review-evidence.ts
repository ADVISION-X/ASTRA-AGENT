import type { AmazonProductDetail, AmazonReviewRecord } from "./amazon-product-mining.schema.js";

export const KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT = 8;
export const KEYWORD_REVIEW_TEXT_VALUE_MAX_CHARS = 360;
export const KEYWORD_REVIEW_RAW_TEXT_MAX_CHARS = 600;
export const KEYWORD_REVIEW_ARRAY_MAX_ITEMS = 8;

export type EvidenceDisclosureReason =
  | "extracted"
  | "not_present"
  | "blocked"
  | "unsupported_structure"
  | "manual_required"
  | "failed"
  | "extractor_missing";

export type EvidenceDisclosureMap = Record<string, { reason: EvidenceDisclosureReason; detail: string | null }>;

export type EvidenceField<T> = {
  status: EvidenceDisclosureReason;
  value?: T;
  detail?: string | null;
};

export const clipKeywordReviewText = (
  value: string | null | undefined,
  maxChars = KEYWORD_REVIEW_TEXT_VALUE_MAX_CHARS,
): string | null => {
  if (!value) {
    return null;
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n[truncated ${value.length - maxChars} chars]`;
};

export const clipKeywordReviewStringArray = (
  values: string[],
  maxItems = KEYWORD_REVIEW_ARRAY_MAX_ITEMS,
  maxChars = KEYWORD_REVIEW_TEXT_VALUE_MAX_CHARS,
): string[] => values
  .slice(0, maxItems)
  .map((value) => clipKeywordReviewText(value, maxChars))
  .filter((value): value is string => Boolean(value));

export const compactKeywordReviewDisclosureMap = (
  fieldDisclosureMap: EvidenceDisclosureMap,
): EvidenceDisclosureMap => Object.fromEntries(
  Object.entries(fieldDisclosureMap).filter(([, disclosure]) => disclosure.reason !== "extracted" || Boolean(disclosure.detail)),
);

const disclosureForField = (
  fieldDisclosureMap: EvidenceDisclosureMap,
  fieldName: string,
  hasValue: boolean,
): { reason: EvidenceDisclosureReason; detail: string | null } => fieldDisclosureMap[fieldName]
  ?? { reason: hasValue ? "extracted" : "not_present", detail: hasValue ? null : "Field was not visible in the captured page evidence." };

const evidenceScalar = (
  fieldDisclosureMap: EvidenceDisclosureMap,
  fieldName: string,
  value: string | null | undefined,
  maxChars = KEYWORD_REVIEW_TEXT_VALUE_MAX_CHARS,
): EvidenceField<string> => {
  const clippedValue = clipKeywordReviewText(value, maxChars);
  const disclosure = disclosureForField(fieldDisclosureMap, fieldName, Boolean(clippedValue));
  return {
    status: disclosure.reason,
    ...(clippedValue ? { value: clippedValue } : {}),
    ...(disclosure.detail ? { detail: disclosure.detail } : {}),
  };
};

const evidenceArray = (
  fieldDisclosureMap: EvidenceDisclosureMap,
  fieldName: string,
  values: string[],
  maxItems = KEYWORD_REVIEW_ARRAY_MAX_ITEMS,
): EvidenceField<string[]> => {
  const clippedValues = clipKeywordReviewStringArray(values, maxItems);
  const disclosure = disclosureForField(fieldDisclosureMap, fieldName, clippedValues.length > 0);
  return {
    status: disclosure.reason,
    ...(clippedValues.length > 0 ? { value: clippedValues } : {}),
    ...(disclosure.detail ? { detail: disclosure.detail } : {}),
  };
};

export const buildKeywordReviewDetailEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  ...buildKeywordReviewIdentityEvidence(product),
  ...buildKeywordReviewMediaEvidence(product),
  ...buildKeywordReviewListingEvidence(product),
  ...buildKeywordReviewCommerceEvidence(product),
  ...buildKeywordReviewRelatedEvidence(product),
  rawVisibleTextSnapshot: evidenceScalar(product.fieldDisclosureMap, "rawVisibleTextSnapshot", product.rawVisibleTextSnapshot, KEYWORD_REVIEW_RAW_TEXT_MAX_CHARS),
});

const buildKeywordReviewIdentityEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  brand: evidenceScalar(product.fieldDisclosureMap, "brand", product.brand),
  sellerOrStoreIfVisible: evidenceScalar(product.fieldDisclosureMap, "sellerOrStoreIfVisible", product.sellerOrStoreIfVisible),
  currentPrice: evidenceScalar(product.fieldDisclosureMap, "currentPrice", product.currentPrice),
  originalPriceDiscountCouponIfVisible: evidenceScalar(product.fieldDisclosureMap, "originalPriceDiscountCouponIfVisible", product.originalPriceDiscountCouponIfVisible),
});

const buildKeywordReviewMediaEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  mainImage: evidenceScalar(product.fieldDisclosureMap, "mainImage", product.mainImage),
  allVisibleImages: evidenceArray(product.fieldDisclosureMap, "allVisibleImages", product.allVisibleImages),
  visibleVideoInfo: evidenceScalar(product.fieldDisclosureMap, "visibleVideoInfo", product.visibleVideoInfo),
});

const buildKeywordReviewListingEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  bulletPoints: evidenceArray(product.fieldDisclosureMap, "bulletPoints", product.bulletPoints),
  aboutThisItem: evidenceScalar(product.fieldDisclosureMap, "aboutThisItem", product.aboutThisItem),
  productDescription: evidenceScalar(product.fieldDisclosureMap, "productDescription", product.productDescription),
  aPlusContentIfVisible: evidenceScalar(product.fieldDisclosureMap, "aPlusContentIfVisible", product.aPlusContentIfVisible),
  aPlusImageUrls: evidenceArray(product.fieldDisclosureMap, "aPlusImageUrls", product.aPlusImageUrls),
  variationOptions: evidenceScalar(product.fieldDisclosureMap, "variationOptions", product.variationOptions),
  colorSizeStyleOptions: evidenceScalar(product.fieldDisclosureMap, "colorSizeStyleOptions", product.colorSizeStyleOptions),
  productInformation: evidenceScalar(product.fieldDisclosureMap, "productInformation", product.productInformation),
  technicalDetails: evidenceScalar(product.fieldDisclosureMap, "technicalDetails", product.technicalDetails),
  additionalInformation: evidenceScalar(product.fieldDisclosureMap, "additionalInformation", product.additionalInformation),
});

const buildKeywordReviewCommerceEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  bestSellersRankIfVisible: evidenceScalar(product.fieldDisclosureMap, "bestSellersRankIfVisible", product.bestSellersRankIfVisible),
  categoryPathIfVisible: evidenceScalar(product.fieldDisclosureMap, "categoryPathIfVisible", product.categoryPathIfVisible),
  rating: evidenceScalar(product.fieldDisclosureMap, "rating", product.rating),
  reviewCount: evidenceScalar(product.fieldDisclosureMap, "reviewCount", product.reviewCount),
  boughtInPastMonthIfVisible: evidenceScalar(product.fieldDisclosureMap, "boughtInPastMonthIfVisible", product.boughtInPastMonthIfVisible),
  starDistribution: evidenceScalar(product.fieldDisclosureMap, "starDistribution", product.starDistribution),
  deliveryInformation: evidenceScalar(product.fieldDisclosureMap, "deliveryInformation", product.deliveryInformation),
  returnInformation: evidenceScalar(product.fieldDisclosureMap, "returnInformation", product.returnInformation),
});

const buildKeywordReviewRelatedEvidence = (
  product: AmazonProductDetail,
): Record<string, EvidenceField<string | string[]>> => ({
  qaContentIfVisible: evidenceScalar(product.fieldDisclosureMap, "qaContentIfVisible", product.qaContentIfVisible),
  frequentlyBoughtTogetherIfVisible: evidenceScalar(product.fieldDisclosureMap, "frequentlyBoughtTogetherIfVisible", product.frequentlyBoughtTogetherIfVisible),
  customersAlsoBoughtIfVisible: evidenceScalar(product.fieldDisclosureMap, "customersAlsoBoughtIfVisible", product.customersAlsoBoughtIfVisible),
  compareWithSimilarItemsIfVisible: evidenceScalar(product.fieldDisclosureMap, "compareWithSimilarItemsIfVisible", product.compareWithSimilarItemsIfVisible),
  allOtherVisibleProductParameters: evidenceScalar(product.fieldDisclosureMap, "allOtherVisibleProductParameters", product.allOtherVisibleProductParameters),
});

export const buildKeywordReviewSample = (review: AmazonReviewRecord) => ({
  reviewId: review.reviewId,
  reviewIdIfAvailable: review.reviewIdIfAvailable,
  reviewerName: evidenceScalar(review.fieldDisclosureMap, "reviewerName", review.reviewerName),
  pageIndex: review.pageIndex,
  rating: review.rating,
  reviewTitle: evidenceScalar(review.fieldDisclosureMap, "reviewTitle", review.reviewTitle),
  reviewBody: evidenceScalar(review.fieldDisclosureMap, "reviewBody", review.reviewBody),
  reviewDate: evidenceScalar(review.fieldDisclosureMap, "reviewDate", review.reviewDate),
  verifiedPurchase: review.verifiedPurchase,
  variant: evidenceScalar(review.fieldDisclosureMap, "variant", review.variant),
  helpfulCountIfVisible: evidenceScalar(review.fieldDisclosureMap, "helpfulCountIfVisible", review.helpfulCountIfVisible),
  reviewImagesIfVisible: clipKeywordReviewStringArray(review.reviewImagesIfVisible),
  reviewVideosIfVisible: clipKeywordReviewStringArray(review.reviewVideosIfVisible),
  reviewLanguage: evidenceScalar(review.fieldDisclosureMap, "reviewLanguage", review.reviewLanguage),
  reviewRegionIfVisible: evidenceScalar(review.fieldDisclosureMap, "reviewRegionIfVisible", review.reviewRegionIfVisible),
  rawReviewTextSnapshot: evidenceScalar(review.fieldDisclosureMap, "rawReviewTextSnapshot", review.rawReviewTextSnapshot, KEYWORD_REVIEW_RAW_TEXT_MAX_CHARS),
  fieldDisclosureMap: compactKeywordReviewDisclosureMap(review.fieldDisclosureMap),
});

export type KeywordReviewSample = ReturnType<typeof buildKeywordReviewSample>;

export const buildKeywordReviewSamples = (reviews: AmazonReviewRecord[]): KeywordReviewSample[] =>
  reviews.slice(0, KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT).map(buildKeywordReviewSample);
