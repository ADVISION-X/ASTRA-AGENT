import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  AMAZON_PACKAGE_FILE_NAMES,
  type AmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
import {
  buildProductMissingFields,
  writeJsonFile,
  type AmazonKeywordRecord,
  type AmazonProductDetail,
  type AmazonReviewRecord,
  type AmazonSearchResultItem,
} from "./amazon-product-mining.package-artifact-builders.js";

type LinkedSearchItem = {
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

type RepresentativeReviewSample = {
  reviewId: string;
  rating: string | null;
  reviewTitle: string | null;
  reviewBodySnippet: string;
  pageIndex: number;
  reviewDate: string | null;
  verifiedPurchase: boolean | null;
};

export type AmazonPackageKeywordEvidence = {
  keywordId: string;
  keyword: string;
  status: string;
  searchUrl: string | null;
  dirPath: string;
  dirRef: string;
  summaryPath: string;
  summaryRef: string;
  searchResultsPath: string;
  searchResultsRef: string;
  searchResultsCsvPath: string;
  searchResultsCsvRef: string;
  rawVisibleTextPath: string;
  rawVisibleTextRef: string;
  itemIds: string[];
  linkedDetailIds: string[];
  sponsoredCount: number;
  organicCount: number;
  topProducts: Array<{
    itemId: string;
    detailId: string | null;
    asinIfAvailable: string | null;
    title: string | null;
    rankPosition: number;
    productUrl: string;
  }>;
  exceptionIds: string[];
};

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

const toPackageRelativePath = (packageRootPath: string, filePath: string): string =>
  relative(packageRootPath, filePath).split("\\").join("/");

const writeTextFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
};

const writeJsonlFile = (filePath: string, rows: readonly unknown[]): void => {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(filePath, rows.length > 0 ? `${content}\n` : "", "utf8");
};

const escapeCsvValue = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const normalized = String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const truncateText = (value: string | null | undefined, maxLength: number): string => {
  const text = value ?? "";
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const parseNumericValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
};

const buildRangeSummary = (values: Array<string | null | undefined>) => {
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

const buildRawTextBlob = (values: Array<string | null | undefined>): string =>
  [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .join("\n\n---\n\n");

const parseRatingValue = (rating: string | null): number | null => {
  if (!rating) return null;
  const match = rating.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
};

const mapRepresentativeReview = (review: AmazonReviewRecord): RepresentativeReviewSample => ({
  reviewId: review.reviewId,
  rating: review.rating,
  reviewTitle: review.reviewTitle,
  reviewBodySnippet: truncateText(review.reviewBody ?? review.rawReviewTextSnapshot ?? "", 180),
  pageIndex: review.pageIndex,
  reviewDate: review.reviewDate,
  verifiedPurchase: review.verifiedPurchase,
});

const buildRepresentativeSamples = (reviews: readonly AmazonReviewRecord[]) => {
  const positive = reviews
    .filter((review) => (parseRatingValue(review.rating) ?? 0) >= 4)
    .slice(0, 3)
    .map(mapRepresentativeReview);
  const negative = reviews
    .filter((review) => (parseRatingValue(review.rating) ?? 5) <= 2)
    .slice(0, 3)
    .map(mapRepresentativeReview);
  const withImages = reviews
    .filter((review) => review.reviewImagesIfVisible.length > 0)
    .slice(0, 3)
    .map(mapRepresentativeReview);

  return { positive, negative, withImages };
};

const buildRatingsDistribution = (reviews: readonly AmazonReviewRecord[]): Record<string, number> => {
  const distribution = new Map<string, number>();
  for (const review of reviews) {
    const key = review.rating ?? "unknown";
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...distribution.entries()].sort((left, right) => left[0].localeCompare(right[0])));
};

const calculateCompletenessScore = (
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

const resolveReviewStatus = (product: AmazonProductDetail, reviews: readonly AmazonReviewRecord[]): string => {
  if (product.status === "manual_required") return "manual_required";
  if (product.status === "failed") return "failed";
  if (reviews.length > 0) return "completed";
  if (product.status === "completed") return "no_reviews_captured";
  return product.status;
};

export const writeKeywordEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  keywords: readonly AmazonKeywordRecord[];
  searchResultsByKeyword: Map<string, AmazonSearchResultItem[]>;
  detailIdsByItemId: Map<string, string[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageKeywordEvidence[] => {
  const artifacts: AmazonPackageKeywordEvidence[] = [];

  for (const keyword of input.keywords) {
    const keywordDir = join(input.layout.keywordSearchEvidenceDir, `keyword-${keyword.keywordId}`);
    mkdirSync(keywordDir, { recursive: true });
    const summaryPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.keywordSummary);
    const searchResultsPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageResults);
    const searchResultsCsvPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageResultsCsv);
    const rawVisibleTextPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageRawVisibleText);
    const searchResults = input.searchResultsByKeyword.get(keyword.keywordId) ?? [];
    const linkedDetailIds = [...new Set(searchResults.flatMap((item) => input.detailIdsByItemId.get(item.itemId) ?? []))];
    const itemExceptionIds = searchResults.flatMap((item) => input.exceptionIdsByScopeId.get(item.itemId) ?? []);
    const exceptionIds = [...new Set([...(input.exceptionIdsByScopeId.get(keyword.keywordId) ?? []), ...itemExceptionIds])];
    const sponsoredCount = searchResults.filter((item) => item.isSponsored).length;
    const organicCount = searchResults.length - sponsoredCount;
    const topProducts = searchResults.slice(0, 10).map((item) => ({
      itemId: item.itemId,
      detailId: (input.detailIdsByItemId.get(item.itemId) ?? [null])[0] ?? null,
      asinIfAvailable: item.asinIfAvailable,
      title: item.title,
      rankPosition: item.rankPosition,
      productUrl: item.productUrl,
    }));

    writeJsonFile(summaryPath, {
      keywordId: keyword.keywordId,
      keyword: keyword.keyword,
      status: keyword.status,
      searchUrl: searchResults[0]?.searchUrl ?? null,
      visibleProductCount: searchResults.length,
      sponsoredCount,
      organicCount,
      topProducts,
      priceRange: buildRangeSummary(searchResults.map((item) => item.price)),
      ratingRange: buildRangeSummary(searchResults.map((item) => item.rating)),
      reviewCountRange: buildRangeSummary(searchResults.map((item) => item.reviewCount)),
      exceptionFlags: exceptionIds,
    });

    writeJsonFile(searchResultsPath, {
      taskId: keyword.taskId,
      keywordId: keyword.keywordId,
      keyword: keyword.keyword,
      searchUrl: searchResults[0]?.searchUrl ?? null,
      capturedAt: searchResults[0]?.createdAt ?? keyword.createdAt,
      status: keyword.status,
      items: searchResults.map((item) => ({
        rank: item.rankPosition,
        placementType: item.isSponsored ? "sponsored" : "organic",
        asin: item.asinIfAvailable,
        title: item.title,
        price: item.price,
        rating: item.rating,
        reviewCount: item.reviewCount,
        mainImageUrl: item.mainImageUrl,
        productUrl: item.productUrl,
        detailIds: input.detailIdsByItemId.get(item.itemId) ?? [],
        rawVisibleTextSnapshot: item.rawVisibleTextSnapshot,
      })),
    });

    const csvRows = [
      ["Rank", "SponsoredOrOrganic", "ASIN", "Title", "Price", "Rating", "ReviewCount", "MainImageURL", "ProductURL", "DetailID"],
      ...searchResults.map((item) => [
        String(item.rankPosition),
        item.isSponsored ? "Sponsored" : "Organic",
        item.asinIfAvailable ?? "",
        item.title ?? "",
        item.price ?? "",
        item.rating ?? "",
        item.reviewCount ?? "",
        item.mainImageUrl ?? "",
        item.productUrl,
        (input.detailIdsByItemId.get(item.itemId) ?? []).join("|"),
      ]),
    ];
    writeTextFile(
      searchResultsCsvPath,
      csvRows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n"),
    );
    writeTextFile(rawVisibleTextPath, buildRawTextBlob(searchResults.map((item) => item.rawVisibleTextSnapshot)));

    artifacts.push({
      keywordId: keyword.keywordId,
      keyword: keyword.keyword,
      status: keyword.status,
      searchUrl: searchResults[0]?.searchUrl ?? null,
      dirPath: keywordDir,
      dirRef: toPackageRelativePath(input.layout.packageRootPath, keywordDir),
      summaryPath,
      summaryRef: toPackageRelativePath(input.layout.packageRootPath, summaryPath),
      searchResultsPath,
      searchResultsRef: toPackageRelativePath(input.layout.packageRootPath, searchResultsPath),
      searchResultsCsvPath,
      searchResultsCsvRef: toPackageRelativePath(input.layout.packageRootPath, searchResultsCsvPath),
      rawVisibleTextPath,
      rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, rawVisibleTextPath),
      itemIds: searchResults.map((item) => item.itemId),
      linkedDetailIds,
      sponsoredCount,
      organicCount,
      topProducts,
      exceptionIds,
    });
  }

  return artifacts;
};

export const writeReviewEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  reviewMaxPages?: number;
}): AmazonPackageReviewEvidence[] => {
  const artifacts: AmazonPackageReviewEvidence[] = [];

  for (const product of input.products) {
    const reviewDir = join(input.layout.reviewEvidenceDir, `product-${product.detailId}`);
    mkdirSync(reviewDir, { recursive: true });
    const reviewsJsonlPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewEvidenceJsonl);
    const reviewsSummaryPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewsSummary);
    const reviewPagesIndexPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewPagesIndex);
    const reviews = input.reviewsByDetailId.get(product.detailId) ?? [];
    const pages = [...new Set(reviews.map((review) => review.pageIndex))].sort((left, right) => left - right);
    const pagesVisited = pages.length;
    const hasImages = reviews.some((review) => review.reviewImagesIfVisible.length > 0);
    const hasVideos = reviews.some((review) => review.reviewVideosIfVisible.length > 0);
    const limitedByConfiguredMaxPages = input.reviewMaxPages !== undefined && pagesVisited >= input.reviewMaxPages;
    const reviewStatus = resolveReviewStatus(product, reviews);
    const warnings = [
      ...(reviews.length === 0 ? ["No accessible reviews were captured for this product."] : []),
      ...(limitedByConfiguredMaxPages ? [`Review pagination may be capped by configured maxPages=${input.reviewMaxPages}.`] : []),
      ...(product.status === "manual_required" ? ["Review extraction ended in manual_required state."] : []),
    ];
    const representativeSamples = buildRepresentativeSamples(reviews);

    writeJsonlFile(
      reviewsJsonlPath,
      reviews.map((review) => ({
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
      })),
    );
    writeJsonFile(reviewsSummaryPath, {
      detailId: product.detailId,
      asin: product.asin,
      capturedReviewCount: reviews.length,
      pagesVisited,
      ratingsDistribution: buildRatingsDistribution(reviews),
      verifiedPurchaseCount: reviews.filter((review) => review.verifiedPurchase === true).length,
      variantValues: [...new Set(reviews.map((review) => review.variant).filter((value): value is string => Boolean(value)))],
      reviewsWithImagesCount: reviews.filter((review) => review.reviewImagesIfVisible.length > 0).length,
      reviewsWithVideosCount: reviews.filter((review) => review.reviewVideosIfVisible.length > 0).length,
      representativeSamples,
      limitations: warnings,
    });
    writeJsonFile(reviewPagesIndexPath, {
      detailId: product.detailId,
      asin: product.asin,
      pagesVisited,
      reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
      limitedByConfiguredMaxPages,
      pages: pages.map((pageIndex) => {
        const pageReviews = reviews.filter((review) => review.pageIndex === pageIndex);
        return {
          pageIndex,
          reviewCount: pageReviews.length,
          reviewIds: pageReviews.map((review) => review.reviewId),
          hasImages: pageReviews.some((review) => review.reviewImagesIfVisible.length > 0),
          hasVideos: pageReviews.some((review) => review.reviewVideosIfVisible.length > 0),
        };
      }),
    });

    artifacts.push({
      detailId: product.detailId,
      asin: product.asin,
      dirPath: reviewDir,
      dirRef: toPackageRelativePath(input.layout.packageRootPath, reviewDir),
      reviewsJsonlPath,
      reviewsJsonlRef: toPackageRelativePath(input.layout.packageRootPath, reviewsJsonlPath),
      reviewsSummaryPath,
      reviewsSummaryRef: toPackageRelativePath(input.layout.packageRootPath, reviewsSummaryPath),
      reviewPagesIndexPath,
      reviewPagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, reviewPagesIndexPath),
      capturedReviewCount: reviews.length,
      pagesVisited,
      hasImages,
      hasVideos,
      reviewStatus,
      warnings,
      representativeSamples,
    });
  }

  return artifacts;
};

export const writeProductEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  products: readonly AmazonProductDetail[];
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageProductEvidence[] => {
  const artifacts: AmazonPackageProductEvidence[] = [];

  for (const product of input.products) {
    const productDir = join(input.layout.productDetailEvidenceDir, `product-${product.detailId}`);
    mkdirSync(productDir, { recursive: true });
    const summaryPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSummary);
    const detailPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetail);
    const rawVisibleTextPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productDetailRawVisibleText);
    const imagesIndexPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productImagesIndex);
    const sourceKeywordsPath = join(productDir, AMAZON_PACKAGE_FILE_NAMES.productSourceKeywords);
    const linkedSearchItems = (input.linkedSearchItemsByDetailId.get(product.detailId) ?? []).map((item) => ({
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
    const reviews = input.reviewsByDetailId.get(product.detailId) ?? [];
    const reviewArtifact = input.reviewArtifactsByDetailId.get(product.detailId);
    const missingFields = buildProductMissingFields(product);
    const completenessScore = calculateCompletenessScore(product, reviews);
    const exceptionIds = [...new Set([
      ...(input.exceptionIdsByScopeId.get(product.detailId) ?? []),
      ...linkedSearchItems.flatMap((item) => input.exceptionIdsByScopeId.get(item.itemId) ?? []),
    ])];
    const warnings = [
      ...(linkedSearchItems.length === 0 ? ["No search-result trace was found for this product."] : []),
      ...(reviews.length === 0 ? ["No review evidence rows were captured for this product."] : []),
      ...(product.status === "manual_required" ? ["Product detail or review stage requires manual follow-up."] : []),
      ...(exceptionIds.length > 0 ? ["Exceptions were recorded for this product trace."] : []),
    ];
    const representativeSamples = buildRepresentativeSamples(reviews);

    writeJsonFile(detailPath, product);
    writeTextFile(rawVisibleTextPath, product.rawVisibleTextSnapshot ?? "");
    writeJsonFile(imagesIndexPath, {
      detailId: product.detailId,
      asin: product.asin,
      mode: "url_only",
      warning: "Images are URL evidence unless localFileRef is present.",
      images: [
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
      ],
    });
    writeJsonFile(sourceKeywordsPath, {
      detailId: product.detailId,
      asin: product.asin,
      sourceKeywords: linkedSearchItems,
    });
    writeJsonFile(summaryPath, {
      detailId: product.detailId,
      asin: product.asin,
      status: product.status,
      failureReason: product.failureReason,
      identity: {
        title: product.title,
        brand: product.brand,
        sellerOrStoreIfVisible: product.sellerOrStoreIfVisible,
      },
      imageEvidence: {
        mode: "url_only",
        imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, imagesIndexPath),
        mainImageUrl: product.mainImage,
        galleryCount: product.allVisibleImages.length,
      },
      sourceKeywords: {
        count: linkedSearchItems.length,
        fileRef: toPackageRelativePath(input.layout.packageRootPath, sourceKeywordsPath),
        keywords: linkedSearchItems,
      },
      pageBusinessInfo: {
        currentPrice: product.currentPrice,
        originalPriceDiscountCouponIfVisible: product.originalPriceDiscountCouponIfVisible,
        rating: product.rating,
        reviewCount: product.reviewCount,
        bestSellersRankIfVisible: product.bestSellersRankIfVisible,
        categoryPathIfVisible: product.categoryPathIfVisible,
        deliveryInformation: product.deliveryInformation,
        returnInformation: product.returnInformation,
      },
      listing: {
        bulletPoints: product.bulletPoints,
        aboutThisItem: product.aboutThisItem,
        productDescription: product.productDescription,
        aPlusContentIfVisible: product.aPlusContentIfVisible,
      },
      parameters: {
        variationOptions: product.variationOptions,
        colorSizeStyleOptions: product.colorSizeStyleOptions,
        productInformation: product.productInformation,
        technicalDetails: product.technicalDetails,
        additionalInformation: product.additionalInformation,
        allOtherVisibleProductParameters: product.allOtherVisibleProductParameters,
      },
      relatedModules: {
        qaContentIfVisible: product.qaContentIfVisible,
        frequentlyBoughtTogetherIfVisible: product.frequentlyBoughtTogetherIfVisible,
        customersAlsoBoughtIfVisible: product.customersAlsoBoughtIfVisible,
        compareWithSimilarItemsIfVisible: product.compareWithSimilarItemsIfVisible,
      },
      reviewSummary: {
        reviewStatus: reviewArtifact?.reviewStatus ?? resolveReviewStatus(product, reviews),
        capturedReviewCount: reviewArtifact?.capturedReviewCount ?? reviews.length,
        reviewsSummaryRef: reviewArtifact?.reviewsSummaryRef ?? null,
        reviewsJsonlRef: reviewArtifact?.reviewsJsonlRef ?? null,
        reviewPagesIndexRef: reviewArtifact?.reviewPagesIndexRef ?? null,
        representativeSamples,
      },
      completeness: {
        score: completenessScore,
        missingFields,
        warnings,
      },
      exceptionRefs: exceptionIds,
      evidenceRefs: {
        detailRef: toPackageRelativePath(input.layout.packageRootPath, detailPath),
        rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, rawVisibleTextPath),
        imagesIndexRef: toPackageRelativePath(input.layout.packageRootPath, imagesIndexPath),
        sourceKeywordsRef: toPackageRelativePath(input.layout.packageRootPath, sourceKeywordsPath),
      },
    });

    artifacts.push({
      detailId: product.detailId,
      asin: product.asin,
      title: product.title,
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
    });
  }

  return artifacts;
};