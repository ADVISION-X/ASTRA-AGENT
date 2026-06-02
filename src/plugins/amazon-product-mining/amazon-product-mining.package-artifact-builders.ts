import { writeFileSync } from "node:fs";

import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type AmazonTaskRecord = NonNullable<ReturnType<AmazonMiningStorage["getTask"]>>;
export type AmazonKeywordRecord = ReturnType<AmazonMiningStorage["getKeywordsForTask"]>[number];
export type AmazonSearchResultItem = ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>[number];
export type AmazonProductDetail = ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>[number];
export type AmazonReviewRecord = ReturnType<AmazonMiningStorage["getReviewsForProduct"]>[number];
export type AmazonExceptionRecord = ReturnType<AmazonMiningStorage["getExceptionsForTask"]>[number];
export type AmazonKeywordOpportunityReviewRecord = ReturnType<AmazonMiningStorage["listKeywordOpportunityReviews"]>[number];

export const writeJsonFile = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export type ProductFieldDisclosureBuckets = {
  missingFields: string[];
  notPresentFields: string[];
  blockedFields: string[];
  unsupportedFields: string[];
  manualRequiredFields: string[];
  failedFields: string[];
  extractorMissingFields: string[];
};

const getFieldNamesByReason = (
  product: AmazonProductDetail,
  reason: AmazonProductDetail["fieldDisclosureMap"][string]["reason"],
): string[] => Object.entries(product.fieldDisclosureMap)
  .filter(([, disclosure]) => disclosure.reason === reason)
  .map(([fieldName]) => fieldName)
  .sort((left, right) => left.localeCompare(right));

const buildNullSignalMissingFields = (product: AmazonProductDetail): string[] => {
  const missingFields: string[] = [];
  if (!product.currentPrice) missingFields.push("currentPrice");
  if (!product.rating) missingFields.push("rating");
  if (!product.reviewCount) missingFields.push("reviewCount");
  if (!product.rawVisibleTextSnapshot) missingFields.push("rawVisibleTextSnapshot");
  return missingFields;
};

export const buildProductFieldDisclosureBuckets = (product: AmazonProductDetail): ProductFieldDisclosureBuckets => {
  const notPresentFields = getFieldNamesByReason(product, "not_present");
  const blockedFields = getFieldNamesByReason(product, "blocked");
  const unsupportedFields = getFieldNamesByReason(product, "unsupported_structure");
  const manualRequiredFields = getFieldNamesByReason(product, "manual_required");
  const failedFields = getFieldNamesByReason(product, "failed");
  const extractorMissingFields = getFieldNamesByReason(product, "extractor_missing");
  const reasonBuckets = [
    notPresentFields,
    blockedFields,
    unsupportedFields,
    manualRequiredFields,
    failedFields,
    extractorMissingFields,
  ];
  const missingFields = Object.keys(product.fieldDisclosureMap).length > 0
    ? [...new Set(reasonBuckets.flat())]
    : buildNullSignalMissingFields(product);
  return {
    missingFields,
    notPresentFields,
    blockedFields,
    unsupportedFields,
    manualRequiredFields,
    failedFields,
    extractorMissingFields,
  };
};

export const buildProductMissingFields = (product: AmazonProductDetail): string[] =>
  buildProductFieldDisclosureBuckets(product).missingFields;
