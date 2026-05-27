import type {
  AmazonExceptionRecord,
  AmazonKeywordRecord,
  AmazonProductDetail,
  AmazonReviewRecord,
  AmazonSearchResultItem,
  AmazonTaskRecord,
} from "./amazon-product-mining.package-artifact-builders.js";
import type { AmazonPackageProductEvidence } from "./amazon-product-mining.package-product-evidence.js";
import type { AmazonPackageReviewEvidence } from "./amazon-product-mining.package-review-evidence.js";
import { buildExceptionScopeMap } from "./amazon-product-mining.package-build-support.js";

export type PackageStatusItem = {
  scope: string;
  scopeId: string | null;
  status: string;
  reason: string | null;
  exceptionRefs: string[];
};

type ImageEvidenceEntry = {
  imageId: string;
  imageType: string;
  source: string;
  taskId: string;
  keywordId: string | null;
  itemId: string | null;
  detailId: string | null;
  reviewId: string | null;
  asin: string | null;
  url: string;
  localFileRef: null;
  hash: null;
  caption: string;
  appearsInMasterReport: true;
};

export type PackageImageEvidenceIndex = {
  taskId: string;
  mode: "url_only";
  warning: string;
  images: ImageEvidenceEntry[];
};

const pushSearchResultImages = (input: {
  images: ImageEvidenceEntry[];
  taskId: string;
  searchResults: readonly AmazonSearchResultItem[];
}): void => {
  for (const item of input.searchResults) {
    if (!item.mainImageUrl) continue;
    input.images.push({
      imageId: `image-${input.images.length + 1}`,
      imageType: "search_main_image",
      source: "search_result",
      taskId: input.taskId,
      keywordId: item.keywordId,
      itemId: item.itemId,
      detailId: null,
      reviewId: null,
      asin: item.asinIfAvailable,
      url: item.mainImageUrl,
      localFileRef: null,
      hash: null,
      caption: item.title ?? item.keyword,
      appearsInMasterReport: true,
    });
  }
};

const pushProductImages = (input: {
  images: ImageEvidenceEntry[];
  taskId: string;
  products: readonly AmazonProductDetail[];
}): void => {
  for (const product of input.products) {
    const urls = [product.mainImage, ...product.allVisibleImages].filter((url): url is string => Boolean(url));
    for (const [index, url] of urls.entries()) {
      input.images.push({
        imageId: `image-${input.images.length + 1}`,
        imageType: index === 0 && product.mainImage === url ? "product_main_image" : "product_gallery_image",
        source: "product_detail",
        taskId: input.taskId,
        keywordId: null,
        itemId: null,
        detailId: product.detailId,
        reviewId: null,
        asin: product.asin,
        url,
        localFileRef: null,
        hash: null,
        caption: product.title ?? product.asin ?? product.detailId,
        appearsInMasterReport: true,
      });
    }
  }
};

const pushReviewImages = (input: {
  images: ImageEvidenceEntry[];
  taskId: string;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}): void => {
  for (const [detailId, reviews] of input.reviewsByDetailId.entries()) {
    for (const review of reviews) {
      for (const imageUrl of review.reviewImagesIfVisible) {
        input.images.push({
          imageId: `image-${input.images.length + 1}`,
          imageType: "review_image",
          source: "review",
          taskId: input.taskId,
          keywordId: null,
          itemId: null,
          detailId,
          reviewId: review.reviewId,
          asin: review.asin,
          url: imageUrl,
          localFileRef: null,
          hash: null,
          caption: review.reviewTitle ?? review.reviewId,
          appearsInMasterReport: true,
        });
      }
    }
  }
};

export const buildImageEvidenceIndex = (input: {
  taskId: string;
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}): PackageImageEvidenceIndex => {
  const images: ImageEvidenceEntry[] = [];
  pushSearchResultImages({ images, taskId: input.taskId, searchResults: input.searchResults });
  pushProductImages({ images, taskId: input.taskId, products: input.products });
  pushReviewImages({ images, taskId: input.taskId, reviewsByDetailId: input.reviewsByDetailId });
  return {
    taskId: input.taskId,
    mode: "url_only",
    warning: "Images are URL evidence unless localFileRef is present.",
    images,
  };
};

export const buildStatusItems = (input: {
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  products: readonly AmazonProductDetail[];
  exceptions: readonly AmazonExceptionRecord[];
  status: "manual_required" | "failed";
}): { taskId: string; count: number; items: PackageStatusItem[] } => {
  const items: PackageStatusItem[] = [];
  const seen = new Set<string>();
  const exceptionScopeMap = buildExceptionScopeMap(input.exceptions);
  const manualRegex = /(manual|required|captcha|login|blocked|restricted)/i;
  const pushItem = (item: PackageStatusItem) => {
    const key = `${item.scope}:${item.scopeId ?? "task"}:${item.status}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };
  if (input.task && input.task.status === input.status) {
    pushItem({ scope: "task", scopeId: input.task.taskId, status: input.task.status, reason: input.task.failureReason, exceptionRefs: [] });
  }
  for (const keyword of input.keywords) {
    if (keyword.status !== input.status) continue;
    pushItem({
      scope: "keyword",
      scopeId: keyword.keywordId,
      status: keyword.status,
      reason: keyword.reason,
      exceptionRefs: exceptionScopeMap.get(keyword.keywordId) ?? [],
    });
  }
  for (const product of input.products) {
    if (product.status !== input.status) continue;
    pushItem({
      scope: "product",
      scopeId: product.detailId,
      status: product.status,
      reason: product.failureReason,
      exceptionRefs: exceptionScopeMap.get(product.detailId) ?? [],
    });
  }
  for (const exception of input.exceptions) {
    const isManualException = manualRegex.test(exception.exceptionKind) || manualRegex.test(exception.message);
    if ((input.status === "manual_required" && !isManualException) || (input.status === "failed" && isManualException)) continue;
    pushItem({
      scope: exception.scope,
      scopeId: exception.scopeId,
      status: input.status,
      reason: exception.message,
      exceptionRefs: [exception.exceptionId],
    });
  }
  return {
    taskId: input.task?.taskId ?? input.keywords[0]?.taskId ?? input.products[0]?.taskId ?? "unknown",
    count: items.length,
    items,
  };
};

export const buildCompletenessReport = (input: {
  taskId: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  exceptions: readonly AmazonExceptionRecord[];
  manualRequiredItems: { count: number };
  failedItems: { count: number };
  reviewMaxPages?: number;
}) => {
  const reviewArtifactsByDetailId = new Map(input.reviewArtifacts.map((artifact) => [artifact.detailId, artifact]));
  const productArtifactsByDetailId = new Map(input.productArtifacts.map((artifact) => [artifact.detailId, artifact]));
  return {
    taskId: input.taskId,
    summary: {
      keywordCountRequested: input.task?.requestedKeywordCount ?? input.keywords.length,
      keywordCountGenerated: input.keywords.length,
      keywordCountCompleted: input.keywords.filter((keyword) => keyword.status === "completed" || keyword.status === "completed_with_errors").length,
      searchResultCount: input.searchResults.length,
      uniqueProductDetailCount: input.products.length,
      reviewCount: [...input.reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0),
      exceptionCount: input.exceptions.length,
      manualRequiredCount: input.manualRequiredItems.count,
      failedCount: input.failedItems.count,
      packageCompletenessStatus: input.manualRequiredItems.count === 0 && input.failedItems.count === 0 ? "complete" : "incomplete",
      reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
    },
    products: input.products.map((product) => {
      const reviewRows = input.reviewsByDetailId.get(product.detailId) ?? [];
      const productArtifact = productArtifactsByDetailId.get(product.detailId);
      const reviewArtifact = reviewArtifactsByDetailId.get(product.detailId);
      const hasReviewRawText = reviewRows.some((review) => Boolean(review.rawReviewTextSnapshot));
      const reviewRestriction = reviewArtifact?.warnings.some((warning) => warning.includes("maxPages"))
        ? "max_pages_limit"
        : product.status === "manual_required" ? "manual_required" : null;
      return {
        detailId: product.detailId,
        asin: product.asin,
        detailStatus: product.status,
        reviewStatus: reviewArtifact?.reviewStatus ?? product.status,
        reviewPagesVisited: reviewArtifact?.pagesVisited ?? 0,
        reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
        reviewRestriction,
        manualRequired: product.status === "manual_required",
        hasRawDetailText: Boolean(product.rawVisibleTextSnapshot),
        hasMainImage: Boolean(product.mainImage),
        hasGalleryImages: product.allVisibleImages.length > 0,
        hasBulletPoints: product.bulletPoints.length > 0,
        hasDescription: Boolean(product.productDescription || product.aboutThisItem),
        hasTechnicalDetails: Boolean(product.technicalDetails || product.productInformation),
        hasReviews: reviewRows.length > 0,
        hasReviewRawText,
        missingFields: productArtifact?.missingFields ?? [],
        dataCompletenessScore: productArtifact?.completenessScore ?? 0,
        warnings: [...(productArtifact?.warnings ?? []), ...(reviewArtifact?.warnings ?? [])],
      };
    }),
  };
};