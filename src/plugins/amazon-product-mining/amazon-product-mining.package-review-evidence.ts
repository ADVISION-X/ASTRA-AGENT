import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { AMAZON_PACKAGE_FILE_NAMES, type AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import {
  type AmazonProductDetail,
  type AmazonReviewRecord,
  writeJsonFile,
} from "./amazon-product-mining.package-artifact-builders.js";
import {
  buildRatingsDistribution,
  buildRepresentativeSamples,
  resolveReviewStatus,
  toPackageRelativePath,
  type RepresentativeReviewSample,
  writeJsonlFile,
} from "./amazon-product-mining.package-evidence-shared.js";

export type AmazonPackageReviewEvidence = {
  detailId: string;
  asin: string | null;
  dirPath: string;
  dirRef: string;
  reviewsJsonlPath: string;
  reviewsJsonlRef: string;
  reviewsSummaryPath: string;
  reviewsSummaryRef: string;
  reviewPagesIndexPath: string;
  reviewPagesIndexRef: string;
  capturedReviewCount: number;
  pagesVisited: number;
  hasImages: boolean;
  hasVideos: boolean;
  reviewStatus: string;
  warnings: string[];
  representativeSamples: {
    positive: RepresentativeReviewSample[];
    negative: RepresentativeReviewSample[];
    withImages: RepresentativeReviewSample[];
  };
};

const buildReviewWarnings = (input: {
  reviews: readonly AmazonReviewRecord[];
  pagesVisited: number;
  reviewMaxPages?: number;
  productStatus: AmazonProductDetail["status"];
}): string[] => [
  ...(input.reviews.length === 0 ? ["No accessible reviews were captured for this product."] : []),
  ...(input.reviewMaxPages !== undefined && input.pagesVisited >= input.reviewMaxPages
    ? [`Review pagination may be capped by configured maxPages=${input.reviewMaxPages}.`]
    : []),
  ...(input.productStatus === "manual_required" ? ["Review extraction ended in manual_required state."] : []),
];

const writeReviewArtifacts = (input: {
  reviewsJsonlPath: string;
  reviewsSummaryPath: string;
  reviewPagesIndexPath: string;
  product: AmazonProductDetail;
  reviews: readonly AmazonReviewRecord[];
  pages: readonly number[];
  pagesVisited: number;
  representativeSamples: AmazonPackageReviewEvidence["representativeSamples"];
  warnings: readonly string[];
  reviewMaxPages?: number;
}) => {
  writeJsonlFile(input.reviewsJsonlPath, input.reviews.map((review) => ({
    reviewId: review.reviewId,
    detailId: review.detailId,
    taskId: review.taskId,
    asin: review.asin,
    pageIndex: review.pageIndex,
    reviewIdIfAvailable: review.reviewIdIfAvailable,
    reviewerName: review.reviewerName,
    rating: review.rating,
    reviewTitle: review.reviewTitle,
    reviewBody: review.reviewBody,
    reviewDate: review.reviewDate,
    verifiedPurchase: review.verifiedPurchase,
    variant: review.variant,
    helpfulCountIfVisible: review.helpfulCountIfVisible,
    reviewImagesIfVisible: review.reviewImagesIfVisible,
    reviewVideosIfVisible: review.reviewVideosIfVisible,
    reviewLanguage: review.reviewLanguage,
    reviewRegionIfVisible: review.reviewRegionIfVisible,
    rawReviewTextSnapshot: review.rawReviewTextSnapshot,
    createdAt: review.createdAt,
  })));
  writeJsonFile(input.reviewsSummaryPath, {
    detailId: input.product.detailId,
    asin: input.product.asin,
    capturedReviewCount: input.reviews.length,
    pagesVisited: input.pagesVisited,
    ratingsDistribution: buildRatingsDistribution(input.reviews),
    verifiedPurchaseCount: input.reviews.filter((review) => review.verifiedPurchase === true).length,
    variantValues: [...new Set(input.reviews.map((review) => review.variant).filter((value): value is string => Boolean(value)))],
    reviewsWithImagesCount: input.reviews.filter((review) => review.reviewImagesIfVisible.length > 0).length,
    reviewsWithVideosCount: input.reviews.filter((review) => review.reviewVideosIfVisible.length > 0).length,
    representativeSamples: input.representativeSamples,
    limitations: input.warnings,
  });
  writeJsonFile(input.reviewPagesIndexPath, {
    detailId: input.product.detailId,
    asin: input.product.asin,
    pagesVisited: input.pagesVisited,
    reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
    limitedByConfiguredMaxPages: input.reviewMaxPages !== undefined && input.pagesVisited >= input.reviewMaxPages,
    pages: input.pages.map((pageIndex) => {
      const pageReviews = input.reviews.filter((review) => review.pageIndex === pageIndex);
      return {
        pageIndex,
        reviewCount: pageReviews.length,
        reviewIds: pageReviews.map((review) => review.reviewId),
        hasImages: pageReviews.some((review) => review.reviewImagesIfVisible.length > 0),
        hasVideos: pageReviews.some((review) => review.reviewVideosIfVisible.length > 0),
      };
    }),
  });
};

const createReviewEvidenceArtifact = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  reviews: readonly AmazonReviewRecord[];
  reviewMaxPages?: number;
}): AmazonPackageReviewEvidence => {
  const reviewDir = join(input.layout.reviewEvidenceDir, `product-${input.product.detailId}`);
  mkdirSync(reviewDir, { recursive: true });
  const reviewsJsonlPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewEvidenceJsonl);
  const reviewsSummaryPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewsSummary);
  const reviewPagesIndexPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewPagesIndex);
  const pages = [...new Set(input.reviews.map((review) => review.pageIndex))].sort((left, right) => left - right);
  const pagesVisited = pages.length;
  const warnings = buildReviewWarnings({
    reviews: input.reviews,
    pagesVisited,
    reviewMaxPages: input.reviewMaxPages,
    productStatus: input.product.status,
  });
  const representativeSamples = buildRepresentativeSamples(input.reviews);
  writeReviewArtifacts({
    reviewsJsonlPath,
    reviewsSummaryPath,
    reviewPagesIndexPath,
    product: input.product,
    reviews: input.reviews,
    pages,
    pagesVisited,
    representativeSamples,
    warnings,
    reviewMaxPages: input.reviewMaxPages,
  });
  return {
    detailId: input.product.detailId,
    asin: input.product.asin,
    dirPath: reviewDir,
    dirRef: toPackageRelativePath(input.layout.packageRootPath, reviewDir),
    reviewsJsonlPath,
    reviewsJsonlRef: toPackageRelativePath(input.layout.packageRootPath, reviewsJsonlPath),
    reviewsSummaryPath,
    reviewsSummaryRef: toPackageRelativePath(input.layout.packageRootPath, reviewsSummaryPath),
    reviewPagesIndexPath,
    reviewPagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, reviewPagesIndexPath),
    capturedReviewCount: input.reviews.length,
    pagesVisited,
    hasImages: input.reviews.some((review) => review.reviewImagesIfVisible.length > 0),
    hasVideos: input.reviews.some((review) => review.reviewVideosIfVisible.length > 0),
    reviewStatus: resolveReviewStatus(input.product, input.reviews),
    warnings,
    representativeSamples,
  };
};

export const writeReviewEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  reviewMaxPages?: number;
}): AmazonPackageReviewEvidence[] =>
  input.products.map((product) => createReviewEvidenceArtifact({
    layout: input.layout,
    product,
    reviews: input.reviewsByDetailId.get(product.detailId) ?? [],
    reviewMaxPages: input.reviewMaxPages,
  }));