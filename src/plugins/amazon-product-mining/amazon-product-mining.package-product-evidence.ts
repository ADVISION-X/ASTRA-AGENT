import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { AMAZON_PACKAGE_FILE_NAMES, type AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import {
  buildProductFieldDisclosureBuckets,
  buildProductMissingFields,
  writeJsonFile,
  type AmazonProductDetail,
  type ProductFieldDisclosureBuckets,
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
  notPresentFields: string[];
  blockedFields: string[];
  unsupportedFields: string[];
  manualRequiredFields: string[];
  failedFields: string[];
  extractorMissingFields: string[];
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
  ...product.aPlusImageUrls.map((imageUrl, index) => ({
    imageId: `${product.detailId}-aplus-${index + 1}`,
    imageType: "a_plus_image",
    url: imageUrl,
    localFileRef: null,
    hash: null,
    caption: `${product.title ?? product.asin ?? product.detailId} A+ image ${index + 1}`,
    appearsInMasterReport: true,
  })),
];

const writeProductEvidenceFiles = (input: {
  product: AmazonProductDetail;
  detailPath: string;
  rawVisibleTextPath: string;
  imagesIndexPath: string;
  sourceKeywordsPath: string;
  linkedSearchItems: readonly LinkedSearchItem[];
}): void => {
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
};

const buildProductIdentitySection = (product: AmazonProductDetail) => ({
  title: product.title,
  brand: product.brand,
  sellerOrStoreIfVisible: product.sellerOrStoreIfVisible,
});

const buildProductImageEvidenceSection = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  imagesIndexPath: string;
}) => ({
  mode: "url_only",
  imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.imagesIndexPath),
  mainImageUrl: input.product.mainImage,
  galleryCount: input.product.allVisibleImages.length,
  aPlusImageCount: input.product.aPlusImageUrls.length,
});

const buildProductBusinessInfoSection = (product: AmazonProductDetail) => ({
  currentPrice: product.currentPrice,
  originalPriceDiscountCouponIfVisible: product.originalPriceDiscountCouponIfVisible,
  rating: product.rating,
  reviewCount: product.reviewCount,
  boughtInPastMonthIfVisible: product.boughtInPastMonthIfVisible,
  starDistribution: product.starDistribution,
  bestSellersRankIfVisible: product.bestSellersRankIfVisible,
  categoryPathIfVisible: product.categoryPathIfVisible,
  deliveryInformation: product.deliveryInformation,
  returnInformation: product.returnInformation,
});

const buildProductListingSection = (product: AmazonProductDetail) => ({
  bulletPoints: product.bulletPoints,
  aboutThisItem: product.aboutThisItem,
  productDescription: product.productDescription,
  aPlusContentIfVisible: product.aPlusContentIfVisible,
  aPlusImageUrls: product.aPlusImageUrls,
});

const buildProductParametersSection = (product: AmazonProductDetail) => ({
  variationOptions: product.variationOptions,
  colorSizeStyleOptions: product.colorSizeStyleOptions,
  productInformation: product.productInformation,
  technicalDetails: product.technicalDetails,
  additionalInformation: product.additionalInformation,
  allOtherVisibleProductParameters: product.allOtherVisibleProductParameters,
});

const buildProductRelatedModulesSection = (product: AmazonProductDetail) => ({
  qaContentIfVisible: product.qaContentIfVisible,
  frequentlyBoughtTogetherIfVisible: product.frequentlyBoughtTogetherIfVisible,
  customersAlsoBoughtIfVisible: product.customersAlsoBoughtIfVisible,
  compareWithSimilarItemsIfVisible: product.compareWithSimilarItemsIfVisible,
});

const buildProductReviewSummarySection = (input: {
  product: AmazonProductDetail;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
  representativeSamples: ReturnType<typeof buildRepresentativeSamples>;
  reviews: readonly AmazonReviewRecord[];
}) => ({
  reviewStatus: input.reviewArtifact?.reviewStatus ?? input.product.status,
  capturedReviewCount: input.reviewArtifact?.capturedReviewCount ?? input.reviews.length,
  reviewsSummaryRef: input.reviewArtifact?.reviewsSummaryRef ?? null,
  reviewsJsonlRef: input.reviewArtifact?.reviewsJsonlRef ?? null,
  reviewPagesIndexRef: input.reviewArtifact?.reviewPagesIndexRef ?? null,
  representativeSamples: input.representativeSamples,
});

const buildProductCompletenessSection = (input: {
  completenessScore: number;
  missingFields: readonly string[];
  notPresentFields: readonly string[];
  blockedFields: readonly string[];
  unsupportedFields: readonly string[];
  manualRequiredFields: readonly string[];
  failedFields: readonly string[];
  extractorMissingFields: readonly string[];
  warnings: readonly string[];
  fieldDisclosureMap: AmazonProductDetail["fieldDisclosureMap"];
}) => ({
  score: input.completenessScore,
  missingFields: input.missingFields,
  notPresentFields: input.notPresentFields,
  blockedFields: input.blockedFields,
  unsupportedFields: input.unsupportedFields,
  manualRequiredFields: input.manualRequiredFields,
  failedFields: input.failedFields,
  extractorMissingFields: input.extractorMissingFields,
  warnings: input.warnings,
  fieldDisclosures: input.fieldDisclosureMap,
});

const buildProductEvidenceRefsSection = (input: {
  layout: AmazonPackageLayout;
  detailPath: string;
  rawVisibleTextPath: string;
  imagesIndexPath: string;
  sourceKeywordsPath: string;
}) => ({
  detailRef: toPackageRelativePath(input.layout.packageRootPath, input.detailPath),
  rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, input.rawVisibleTextPath),
  imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.imagesIndexPath),
  sourceKeywordsRef: toPackageRelativePath(input.layout.packageRootPath, input.sourceKeywordsPath),
});

const buildProductSummaryArtifact = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  imagesIndexPath: string;
  sourceKeywordsPath: string;
  detailPath: string;
  rawVisibleTextPath: string;
  linkedSearchItems: readonly LinkedSearchItem[];
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
  representativeSamples: ReturnType<typeof buildRepresentativeSamples>;
  reviews: readonly AmazonReviewRecord[];
  warnings: readonly string[];
  missingFields: readonly string[];
  fieldDisclosureBuckets: ProductFieldDisclosureBuckets;
  completenessScore: number;
  exceptionIds: readonly string[];
}) => ({
  detailId: input.product.detailId,
  asin: input.product.asin,
  status: input.product.status,
  failureReason: input.product.failureReason,
  identity: buildProductIdentitySection(input.product),
  imageEvidence: buildProductImageEvidenceSection(input),
  sourceKeywords: {
    count: input.linkedSearchItems.length,
    fileRef: toPackageRelativePath(input.layout.packageRootPath, input.sourceKeywordsPath),
    keywords: input.linkedSearchItems,
  },
  pageBusinessInfo: buildProductBusinessInfoSection(input.product),
  listing: buildProductListingSection(input.product),
  parameters: buildProductParametersSection(input.product),
  relatedModules: buildProductRelatedModulesSection(input.product),
  reviewSummary: buildProductReviewSummarySection(input),
  completeness: buildProductCompletenessSection({
    completenessScore: input.completenessScore,
    missingFields: input.missingFields,
    notPresentFields: input.fieldDisclosureBuckets.notPresentFields,
    blockedFields: input.fieldDisclosureBuckets.blockedFields,
    unsupportedFields: input.fieldDisclosureBuckets.unsupportedFields,
    manualRequiredFields: input.fieldDisclosureBuckets.manualRequiredFields,
    failedFields: input.fieldDisclosureBuckets.failedFields,
    extractorMissingFields: input.fieldDisclosureBuckets.extractorMissingFields,
    warnings: input.warnings,
    fieldDisclosureMap: input.product.fieldDisclosureMap,
  }),
  exceptionRefs: input.exceptionIds,
  evidenceRefs: buildProductEvidenceRefsSection(input),
});

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
  fieldDisclosureBuckets: ProductFieldDisclosureBuckets;
  completenessScore: number;
  exceptionIds: readonly string[];
}) => {
  const representativeSamples = buildRepresentativeSamples(input.reviews);
  writeProductEvidenceFiles(input);
  writeJsonFile(input.summaryPath, buildProductSummaryArtifact({
    layout: input.layout,
    product: input.product,
    imagesIndexPath: input.imagesIndexPath,
    sourceKeywordsPath: input.sourceKeywordsPath,
    detailPath: input.detailPath,
    rawVisibleTextPath: input.rawVisibleTextPath,
    linkedSearchItems: input.linkedSearchItems,
    reviewArtifact: input.reviewArtifact,
    representativeSamples,
    reviews: input.reviews,
    warnings: input.warnings,
    missingFields: input.missingFields,
    fieldDisclosureBuckets: input.fieldDisclosureBuckets,
    completenessScore: input.completenessScore,
    exceptionIds: input.exceptionIds,
  }));
};

const createProductEvidencePaths = (input: {
  layout: AmazonPackageLayout;
  detailId: string;
}) => {
  const productDir = join(input.layout.productDetailEvidenceDir, `product-${input.detailId}`);
  return {
    productDir,
    summaryPath: join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSummary),
    detailPath: join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetail),
    rawVisibleTextPath: join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetailRawVisibleText),
    imagesIndexPath: join(productDir, AMAZON_PACKAGE_FILE_NAMES.productImagesIndex),
    sourceKeywordsPath: join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSourceKeywords),
  };
};

const buildProductEvidenceRuntime = (input: {
  product: AmazonProductDetail;
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}) => {
  const linkedSearchItems = mapLinkedSearchItems(input.linkedSearchItemsByDetailId.get(input.product.detailId) ?? []);
  const reviews = input.reviewsByDetailId.get(input.product.detailId) ?? [];
  const reviewArtifact = input.reviewArtifactsByDetailId.get(input.product.detailId);
  const fieldDisclosureBuckets = buildProductFieldDisclosureBuckets(input.product);
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
  return {
    linkedSearchItems,
    reviews,
    reviewArtifact,
    fieldDisclosureBuckets,
    missingFields,
    completenessScore,
    exceptionIds,
    warnings,
  };
};

const buildProductEvidenceArtifactRecord = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  productDir: string;
  summaryPath: string;
  detailPath: string;
  rawVisibleTextPath: string;
  imagesIndexPath: string;
  sourceKeywordsPath: string;
  linkedSearchItems: LinkedSearchItem[];
  fieldDisclosureBuckets: ProductFieldDisclosureBuckets;
  missingFields: string[];
  completenessScore: number;
  warnings: string[];
  exceptionIds: string[];
}): AmazonPackageProductEvidence => ({
  detailId: input.product.detailId,
  asin: input.product.asin,
  title: input.product.title,
  dirPath: input.productDir,
  dirRef: toPackageRelativePath(input.layout.packageRootPath, input.productDir),
  summaryPath: input.summaryPath,
  summaryRef: toPackageRelativePath(input.layout.packageRootPath, input.summaryPath),
  detailPath: input.detailPath,
  detailRef: toPackageRelativePath(input.layout.packageRootPath, input.detailPath),
  rawVisibleTextPath: input.rawVisibleTextPath,
  rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, input.rawVisibleTextPath),
  imagesIndexPath: input.imagesIndexPath,
  imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.imagesIndexPath),
  sourceKeywordsPath: input.sourceKeywordsPath,
  sourceKeywordsRef: toPackageRelativePath(input.layout.packageRootPath, input.sourceKeywordsPath),
  sourceKeywords: input.linkedSearchItems,
  sourceItemIds: input.linkedSearchItems.map((item) => item.itemId),
  missingFields: input.missingFields,
  notPresentFields: input.fieldDisclosureBuckets.notPresentFields,
  blockedFields: input.fieldDisclosureBuckets.blockedFields,
  unsupportedFields: input.fieldDisclosureBuckets.unsupportedFields,
  manualRequiredFields: input.fieldDisclosureBuckets.manualRequiredFields,
  failedFields: input.fieldDisclosureBuckets.failedFields,
  extractorMissingFields: input.fieldDisclosureBuckets.extractorMissingFields,
  completenessScore: input.completenessScore,
  warnings: input.warnings,
  exceptionIds: input.exceptionIds,
});

const createProductEvidenceArtifact = (input: {
  layout: AmazonPackageLayout;
  product: AmazonProductDetail;
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageProductEvidence => {
  const paths = createProductEvidencePaths({ layout: input.layout, detailId: input.product.detailId });
  const runtime = buildProductEvidenceRuntime(input);
  const productDir = paths.productDir;
  mkdirSync(productDir, { recursive: true });
  writeProductArtifacts({
    layout: input.layout,
    product: input.product,
    detailPath: paths.detailPath,
    rawVisibleTextPath: paths.rawVisibleTextPath,
    imagesIndexPath: paths.imagesIndexPath,
    sourceKeywordsPath: paths.sourceKeywordsPath,
    summaryPath: paths.summaryPath,
    linkedSearchItems: runtime.linkedSearchItems,
    reviewArtifact: runtime.reviewArtifact,
    reviews: runtime.reviews,
    warnings: runtime.warnings,
    missingFields: runtime.missingFields,
    fieldDisclosureBuckets: runtime.fieldDisclosureBuckets,
    completenessScore: runtime.completenessScore,
    exceptionIds: runtime.exceptionIds,
  });
  return buildProductEvidenceArtifactRecord({
    layout: input.layout,
    product: input.product,
    productDir,
    summaryPath: paths.summaryPath,
    detailPath: paths.detailPath,
    rawVisibleTextPath: paths.rawVisibleTextPath,
    imagesIndexPath: paths.imagesIndexPath,
    sourceKeywordsPath: paths.sourceKeywordsPath,
    linkedSearchItems: runtime.linkedSearchItems,
    fieldDisclosureBuckets: runtime.fieldDisclosureBuckets,
    missingFields: runtime.missingFields,
    completenessScore: runtime.completenessScore,
    warnings: runtime.warnings,
    exceptionIds: runtime.exceptionIds,
  });
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
