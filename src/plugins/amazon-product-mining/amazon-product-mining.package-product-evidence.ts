import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { AMAZON_PACKAGE_FILE_NAMES, type AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import {
  buildProductMissingFields,
  writeJsonFile,
  type AmazonProductDetail,
  type AmazonReviewRecord,
  type AmazonSearchResultItem,
} from "./amazon-product-mining.package-artifact-builders.js";
import {
  calculateCompletenessScore,
  buildRepresentativeSamples,
  toPackageRelativePath,
  type LinkedSearchItem,
  writeTextFile,
} from "./amazon-product-mining.package-evidence-shared.js";
import type { AmazonPackageReviewEvidence } from "./amazon-product-mining.package-review-evidence.js";

export type AmazonPackageProductEvidence = {
  detailId: string;
  asin: string | null;
  title: string | null;
  dirPath: string;
  dirRef: string;
  summaryPath: string;
  summaryRef: string;
  detailPath: string;
  detailRef: string;
  rawVisibleTextPath: string;
  rawVisibleTextRef: string;
  imagesIndexPath: string;
  imagesIndexRef: string;
  sourceKeywordsPath: string;
  sourceKeywordsRef: string;
  sourceKeywords: LinkedSearchItem[];
  sourceItemIds: string[];
  missingFields: string[];
  completenessScore: number;
  warnings: string[];
  exceptionIds: string[];
};

const mapLinkedSearchItems = (searchItems: readonly AmazonSearchResultItem[]): LinkedSearchItem[] =>
  searchItems.map((item) => ({
    itemId: item.itemId,
    keywordId: item.keywordId,
    keyword: item.keyword,
    rankPosition: item.rankPosition,
    isSponsored: item.isSponsored,
    searchUrl: item.searchUrl,
    productUrl: item.productUrl,
    asinIfAvailable: item.asinIfAvailable,
    title: item.title,
  }));

const buildProductWarnings = (input: {
  linkedSearchItems: readonly LinkedSearchItem[];
  reviews: readonly AmazonReviewRecord[];
  productStatus: AmazonProductDetail["status"];
  exceptionIds: readonly string[];
}): string[] => [
  ...(input.linkedSearchItems.length === 0 ? ["No search-result trace was found for this product."] : []),
  ...(input.reviews.length === 0 ? ["No review evidence rows were captured for this product."] : []),
  ...(input.productStatus === "manual_required" ? ["Product detail or review stage requires manual follow-up."] : []),
  ...(input.exceptionIds.length > 0 ? ["Exceptions were recorded for this product trace."] : []),
];

const buildProductImageEntries = (product: AmazonProductDetail) => [
  ...(product.mainImage
    ? [{
        imageId: `${product.detailId}-main`,
        imageType: "product_main_image",
        url: product.mainImage,
        localFileRef: null,
        hash: null,
        caption: product.title ?? product.asin ?? product.detailId,
        appearsInMasterReport: true,
      }]
    : []),
  ...product.allVisibleImages.map((imageUrl, index) => ({
    imageId: `${product.detailId}-gallery-${index + 1}`,
    imageType: "product_gallery_image",
    url: imageUrl,
    localFileRef: null,
    hash: null,
    caption: `${product.title ?? product.asin ?? product.detailId} image ${index + 1}`,
    appearsInMasterReport: true,
  })),
];

const writeProductArtifacts = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  detailPath: string;
  rawVisibleTextPath: string;
  imagesIndexPath: string;
  sourceKeywordsPath: string;
  summaryPath: string;
  linkedSearchItems: readonly LinkedSearchItem[];
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
  reviews: readonly AmazonReviewRecord[];
  warnings: readonly string[];
  missingFields: readonly string[];
  completenessScore: number;
  exceptionIds: readonly string[];
}) => {
  const representativeSamples = buildRepresentativeSamples(input.reviews);
  writeJsonFile(input.detailPath, input.product);
  writeTextFile(input.rawVisibleTextPath, input.product.rawVisibleTextSnapshot ?? "");
  writeJsonFile(input.imagesIndexPath, {
    detailId: input.product.detailId,
    asin: input.product.asin,
    mode: "url_only",
    warning: "Images are URL evidence unless localFileRef is present.",
    images: buildProductImageEntries(input.product),
  });
  writeJsonFile(input.sourceKeywordsPath, {
    detailId: input.product.detailId,
    asin: input.product.asin,
    sourceKeywords: input.linkedSearchItems,
  });
  writeJsonFile(input.summaryPath, {
    detailId: input.product.detailId,
    asin: input.product.asin,
    status: input.product.status,
    failureReason: input.product.failureReason,
    identity: {
      title: input.product.title,
      brand: input.product.brand,
      sellerOrStoreIfVisible: input.product.sellerOrStoreIfVisible,
    },
    imageEvidence: {
      mode: "url_only",
      imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.imagesIndexPath),
      mainImageUrl: input.product.mainImage,
      galleryCount: input.product.allVisibleImages.length,
    },
    sourceKeywords: {
      count: input.linkedSearchItems.length,
      fileRef: toPackageRelativePath(input.layout.packageRootPath, input.sourceKeywordsPath),
      keywords: input.linkedSearchItems,
    },
    pageBusinessInfo: {
      currentPrice: input.product.currentPrice,
      originalPriceDiscountCouponIfVisible: input.product.originalPriceDiscountCouponIfVisible,
      rating: input.product.rating,
      reviewCount: input.product.reviewCount,
      bestSellersRankIfVisible: input.product.bestSellersRankIfVisible,
      categoryPathIfVisible: input.product.categoryPathIfVisible,
      deliveryInformation: input.product.deliveryInformation,
      returnInformation: input.product.returnInformation,
    },
    listing: {
      bulletPoints: input.product.bulletPoints,
      aboutThisItem: input.product.aboutThisItem,
      productDescription: input.product.productDescription,
      aPlusContentIfVisible: input.product.aPlusContentIfVisible,
    },
    parameters: {
      variationOptions: input.product.variationOptions,
      colorSizeStyleOptions: input.product.colorSizeStyleOptions,
      productInformation: input.product.productInformation,
      technicalDetails: input.product.technicalDetails,
      additionalInformation: input.product.additionalInformation,
      allOtherVisibleProductParameters: input.product.allOtherVisibleProductParameters,
    },
    relatedModules: {
      qaContentIfVisible: input.product.qaContentIfVisible,
      frequentlyBoughtTogetherIfVisible: input.product.frequentlyBoughtTogetherIfVisible,
      customersAlsoBoughtIfVisible: input.product.customersAlsoBoughtIfVisible,
      compareWithSimilarItemsIfVisible: input.product.compareWithSimilarItemsIfVisible,
    },
    reviewSummary: {
      reviewStatus: input.reviewArtifact?.reviewStatus ?? input.product.status,
      capturedReviewCount: input.reviewArtifact?.capturedReviewCount ?? input.reviews.length,
      reviewsSummaryRef: input.reviewArtifact?.reviewsSummaryRef ?? null,
      reviewsJsonlRef: input.reviewArtifact?.reviewsJsonlRef ?? null,
      reviewPagesIndexRef: input.reviewArtifact?.reviewPagesIndexRef ?? null,
      representativeSamples,
    },
    completeness: {
      score: input.completenessScore,
      missingFields: input.missingFields,
      warnings: input.warnings,
    },
    exceptionRefs: input.exceptionIds,
    evidenceRefs: {
      detailRef: toPackageRelativePath(input.layout.packageRootPath, input.detailPath),
      rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, input.rawVisibleTextPath),
      imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.imagesIndexPath),
      sourceKeywordsRef: toPackageRelativePath(input.layout.packageRootPath, input.sourceKeywordsPath),
    },
  });
};

const createProductEvidenceArtifact = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageProductEvidence => {
  const productDir = join(input.layout.productDetailEvidenceDir, `product-${input.product.detailId}`);
  mkdirSync(productDir, { recursive: true });
  const summaryPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSummary);
  const detailPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetail);
  const rawVisibleTextPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetailRawVisibleText);
  const imagesIndexPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productImagesIndex);
  const sourceKeywordsPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSourceKeywords);
  const linkedSearchItems = mapLinkedSearchItems(input.linkedSearchItemsByDetailId.get(input.product.detailId) ?? []);
  const reviews = input.reviewsByDetailId.get(input.product.detailId) ?? [];
  const reviewArtifact = input.reviewArtifactsByDetailId.get(input.product.detailId);
  const missingFields = buildProductMissingFields(input.product);
  const completenessScore = calculateCompletenessScore(input.product, reviews);
  const exceptionIds = [...new Set([
    ...(input.exceptionIdsByScopeId.get(input.product.detailId) ?? []),
    ...linkedSearchItems.flatMap((item) => input.exceptionIdsByScopeId.get(item.itemId) ?? []),
  ])];
  const warnings = buildProductWarnings({
    linkedSearchItems,
    reviews,
    productStatus: input.product.status,
    exceptionIds,
  });
  writeProductArtifacts({
    layout: input.layout,
    product: input.product,
    detailPath,
    rawVisibleTextPath,
    imagesIndexPath,
    sourceKeywordsPath,
    summaryPath,
    linkedSearchItems,
    reviewArtifact,
    reviews,
    warnings,
    missingFields,
    completenessScore,
    exceptionIds,
  });
  return {
    detailId: input.product.detailId,
    asin: input.product.asin,
    title: input.product.title,
    dirPath: productDir,
    dirRef: toPackageRelativePath(input.layout.packageRootPath, productDir),
    summaryPath,
    summaryRef: toPackageRelativePath(input.layout.packageRootPath, summaryPath),
    detailPath,
    detailRef: toPackageRelativePath(input.layout.packageRootPath, detailPath),
    rawVisibleTextPath,
    rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, rawVisibleTextPath),
    imagesIndexPath,
    imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, imagesIndexPath),
    sourceKeywordsPath,
    sourceKeywordsRef: toPackageRelativePath(input.layout.packageRootPath, sourceKeywordsPath),
    sourceKeywords: linkedSearchItems,
    sourceItemIds: linkedSearchItems.map((item) => item.itemId),
    missingFields,
    completenessScore,
    warnings,
    exceptionIds,
  };
};

export const writeProductEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  products: readonly AmazonProductDetail[];
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageProductEvidence[] =>
  input.products.map((product) => createProductEvidenceArtifact({
    layout: input.layout,
    product,
    linkedSearchItemsByDetailId: input.linkedSearchItemsByDetailId,
    reviewArtifactsByDetailId: input.reviewArtifactsByDetailId,
    reviewsByDetailId: input.reviewsByDetailId,
    exceptionIdsByScopeId: input.exceptionIdsByScopeId,
  }));