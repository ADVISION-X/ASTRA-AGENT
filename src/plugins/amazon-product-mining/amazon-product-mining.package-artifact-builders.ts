import { writeFileSync } from "node:fs";

import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type AmazonTaskRecord = NonNullable<ReturnType<AmazonMiningStorage["getTask"]>>;
export type AmazonKeywordRecord = ReturnType<AmazonMiningStorage["getKeywordsForTask"]>[number];
export type AmazonSearchResultItem = ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>[number];
export type AmazonProductDetail = ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>[number];
export type AmazonReviewRecord = ReturnType<AmazonMiningStorage["getReviewsForProduct"]>[number];
export type AmazonExceptionRecord = ReturnType<AmazonMiningStorage["getExceptionsForTask"]>[number];

export const writeJsonFile = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const buildProductMissingFields = (product: AmazonProductDetail): string[] => {
  const missingFields: string[] = [];
  if (!product.currentPrice) missingFields.push("currentPrice");
  if (!product.rating) missingFields.push("rating");
  if (!product.reviewCount) missingFields.push("reviewCount");
  if (!product.rawVisibleTextSnapshot) missingFields.push("rawVisibleTextSnapshot");
  return missingFields;
};