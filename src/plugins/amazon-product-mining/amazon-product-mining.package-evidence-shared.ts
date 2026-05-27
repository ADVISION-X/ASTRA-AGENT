import { writeFileSync } from "node:fs";
import { relative } from "node:path";

import type {
  AmazonProductDetail,
  AmazonReviewRecord,
} from "./amazon-product-mining.package-artifact-builders.js";

export type LinkedSearchItem = {
  itemId: string;
  keywordId: string;
  keyword: string;
  rankPosition: number;
  isSponsored: boolean;
  searchUrl: string;
  productUrl: string;
  asinIfAvailable: string | null;
  title: string | null;
};

export type RepresentativeReviewSample = {
  reviewId: string;
  rating: string | null;
  reviewTitle: string | null;
  reviewBodySnippet: string;
  pageIndex: number;
  reviewDate: string | null;
  verifiedPurchase: boolean | null;
};

export const toPackageRelativePath = (packageRootPath: string, filePath: string): string =>
  relative(packageRootPath, filePath).split("\\").join("/");

export const writeTextFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
};

export const writeJsonlFile = (filePath: string, rows: readonly unknown[]): void => {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(filePath, rows.length > 0 ? `${content}\n` : "", "utf8");
};

export const escapeCsvValue = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const normalized = String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

export const truncateText = (value: string | null | undefined, maxLength: number): string => {
  const text = value ?? "";
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const parseNumericValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
};

export const buildRangeSummary = (values: Array<string | null | undefined>) => {
  const numericValues = values
    .map((value) => parseNumericValue(value))
    .filter((value): value is number => value !== null);
  if (numericValues.length === 0) {
    return {
      min: null,
      max: null,
      sampleValues: values.filter((value): value is string => Boolean(value)).slice(0, 5),
    };
  }
  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
    sampleValues: values.filter((value): value is string => Boolean(value)).slice(0, 5),
  };
};

export const buildRawTextBlob = (values: Array<string | null | undefined>): string =>
  [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .join("\n\n---\n\n");

const parseRatingValue = (rating: string | null): number | null => {
  if (!rating) return null;
  const match = rating.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
};

export const mapRepresentativeReview = (review: AmazonReviewRecord): RepresentativeReviewSample => ({
  reviewId: review.reviewId,
  rating: review.rating,
  reviewTitle: review.reviewTitle,
  reviewBodySnippet: truncateText(review.reviewBody ?? review.rawReviewTextSnapshot ?? "", 180),
  pageIndex: review.pageIndex,
  reviewDate: review.reviewDate,
  verifiedPurchase: review.verifiedPurchase,
});

export const buildRepresentativeSamples = (reviews: readonly AmazonReviewRecord[]) => ({
  positive: reviews
    .filter((review) => (parseRatingValue(review.rating) ?? 0) >= 4)
    .slice(0, 3)
    .map(mapRepresentativeReview),
  negative: reviews
    .filter((review) => (parseRatingValue(review.rating) ?? 5) <= 2)
    .slice(0, 3)
    .map(mapRepresentativeReview),
  withImages: reviews
    .filter((review) => review.reviewImagesIfVisible.length > 0)
    .slice(0, 3)
    .map(mapRepresentativeReview),
});

export const buildRatingsDistribution = (reviews: readonly AmazonReviewRecord[]): Record<string, number> => {
  const distribution = new Map<string, number>();
  for (const review of reviews) {
    const key = review.rating ?? "unknown";
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...distribution.entries()].sort((left, right) => left[0].localeCompare(right[0])));
};

export const calculateCompletenessScore = (
  product: AmazonProductDetail,
  reviews: readonly AmazonReviewRecord[],
): number => {
  const signals = [
    Boolean(product.rawVisibleTextSnapshot),
    Boolean(product.mainImage),
    product.allVisibleImages.length > 0,
    product.bulletPoints.length > 0,
    Boolean(product.productDescription || product.aboutThisItem),
    Boolean(product.technicalDetails || product.productInformation),
    reviews.length > 0,
    reviews.some((review) => Boolean(review.rawReviewTextSnapshot)),
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
};

export const resolveReviewStatus = (
  product: AmazonProductDetail,
  reviews: readonly AmazonReviewRecord[],
): string => {
  if (product.status === "manual_required") return "manual_required";
  if (product.status === "failed") return "failed";
  if (reviews.length > 0) return "completed";
  if (product.status === "completed") return "no_reviews_captured";
  return product.status;
};