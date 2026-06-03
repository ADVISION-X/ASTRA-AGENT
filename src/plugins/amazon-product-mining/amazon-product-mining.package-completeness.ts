import type {
  AmazonExceptionRecord,
  AmazonKeywordRecord,
  AmazonKeywordOpportunityReviewRecord,
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
    const urls = [
      { imageType: "product_main_image", url: product.mainImage },
      ...product.allVisibleImages.map((url) => ({ imageType: "product_gallery_image", url })),
      ...product.aPlusImageUrls.map((url) => ({ imageType: "a_plus_image", url })),
    ].filter((entry): entry is { imageType: string; url: string } => Boolean(entry.url));
    for (const entry of urls) {
      input.images.push({
        imageId: `image-${input.images.length + 1}`,
        imageType: entry.imageType,
        source: "product_detail",
        taskId: input.taskId,
        keywordId: null,
        itemId: null,
        detailId: product.detailId,
        reviewId: null,
        asin: product.asin,
        url: entry.url,
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
      for (const videoUrl of review.reviewVideosIfVisible) {
        input.images.push({
          imageId: `image-${input.images.length + 1}`,
          imageType: "review_video",
          source: "review",
          taskId: input.taskId,
          keywordId: null,
          itemId: null,
          detailId,
          reviewId: review.reviewId,
          asin: review.asin,
          url: videoUrl,
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

  const createStatusItemPusher = (items: PackageStatusItem[]): ((item: PackageStatusItem) => void) => {
    const seen = new Set<string>();
    return (item: PackageStatusItem) => {
      const key = `${item.scope}:${item.scopeId ?? "task"}:${item.status}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      items.push(item);
    };
  };

  const appendTaskStatusItem = (input: {
    task: AmazonTaskRecord | null;
    status: "manual_required" | "failed";
    pushItem: (item: PackageStatusItem) => void;
  }): void => {
    if (input.task && input.task.status === input.status) {
      input.pushItem({
        scope: "task",
        scopeId: input.task.taskId,
        status: input.task.status,
        reason: input.task.failureReason,
        exceptionRefs: [],
      });
    }
  };

const appendKeywordStatusItems = (input: {
  keywords: readonly AmazonKeywordRecord[];
  status: "manual_required" | "failed";
  exceptionScopeMap: Map<string, string[]>;
  pushItem: (item: PackageStatusItem) => void;
  }): void => {
    for (const keyword of input.keywords) {
      if (keyword.status !== input.status) {
        continue;
      }
      input.pushItem({
        scope: "keyword",
        scopeId: keyword.keywordId,
        status: keyword.status,
        reason: keyword.reason,
        exceptionRefs: input.exceptionScopeMap.get(keyword.keywordId) ?? [],
      });
  }
};

const appendKeywordReviewStatusItems = (input: {
  keywordReviews: readonly AmazonKeywordOpportunityReviewRecord[];
  status: "manual_required" | "failed";
  pushItem: (item: PackageStatusItem) => void;
}): void => {
  for (const review of input.keywordReviews) {
    if (review.status !== input.status) {
      continue;
    }
    input.pushItem({
      scope: "keyword_review",
      scopeId: review.keywordId,
      status: input.status,
      reason: review.failureReason,
      exceptionRefs: review.aiResponseRef ? [review.aiResponseRef] : [],
    });
  }
};

const appendProductStatusItems = (input: {
  products: readonly AmazonProductDetail[];
    status: "manual_required" | "failed";
    exceptionScopeMap: Map<string, string[]>;
    pushItem: (item: PackageStatusItem) => void;
  }): void => {
    for (const product of input.products) {
      if (product.status !== input.status) {
        continue;
      }
      input.pushItem({
        scope: "product",
        scopeId: product.detailId,
        status: product.status,
        reason: product.failureReason,
        exceptionRefs: input.exceptionScopeMap.get(product.detailId) ?? [],
      });
    }
  };

  const isManualException = (exception: AmazonExceptionRecord): boolean =>
    /(manual|required|captcha|login|blocked|restricted)/i.test(exception.exceptionKind)
    || /(manual|required|captcha|login|blocked|restricted)/i.test(exception.message);

  const appendExceptionStatusItems = (input: {
    exceptions: readonly AmazonExceptionRecord[];
    status: "manual_required" | "failed";
    pushItem: (item: PackageStatusItem) => void;
  }): void => {
    for (const exception of input.exceptions) {
      const manual = isManualException(exception);
      if ((input.status === "manual_required" && !manual) || (input.status === "failed" && manual)) {
        continue;
      }
      input.pushItem({
        scope: exception.scope,
        scopeId: exception.scopeId,
        status: input.status,
        reason: exception.message,
        exceptionRefs: [exception.exceptionId],
      });
    }
  };

  const resolveStatusTaskId = (input: {
    task: AmazonTaskRecord | null;
    keywords: readonly AmazonKeywordRecord[];
    products: readonly AmazonProductDetail[];
  }): string => input.task?.taskId ?? input.keywords[0]?.taskId ?? input.products[0]?.taskId ?? "unknown";

export const buildStatusItems = (input: {
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  keywordReviews?: readonly AmazonKeywordOpportunityReviewRecord[];
  products: readonly AmazonProductDetail[];
  exceptions: readonly AmazonExceptionRecord[];
  status: "manual_required" | "failed";
}): { taskId: string; count: number; items: PackageStatusItem[] } => {
  const items: PackageStatusItem[] = [];
  const exceptionScopeMap = buildExceptionScopeMap(input.exceptions);
  const pushItem = createStatusItemPusher(items);
  appendTaskStatusItem({ task: input.task, status: input.status, pushItem });
  appendKeywordStatusItems({ keywords: input.keywords, status: input.status, exceptionScopeMap, pushItem });
  appendKeywordReviewStatusItems({ keywordReviews: input.keywordReviews ?? [], status: input.status, pushItem });
  appendProductStatusItems({ products: input.products, status: input.status, exceptionScopeMap, pushItem });
  appendExceptionStatusItems({ exceptions: input.exceptions, status: input.status, pushItem });
  return {
    taskId: resolveStatusTaskId(input),
    count: items.length,
    items,
  };
};

const buildCompletenessSummary = (input: {
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  keywordReviews: readonly AmazonKeywordOpportunityReviewRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptions: readonly AmazonExceptionRecord[];
  manualRequiredItems: { count: number };
  failedItems: { count: number };
  reviewMaxPages?: number;
}) => ({
  keywordCountRequested: input.task?.requestedKeywordCount ?? input.keywords.length,
  keywordCountGenerated: input.keywords.length,
  keywordCountCompleted: input.keywords.filter((keyword) => keyword.status === "completed" || keyword.status === "completed_with_errors").length,
  keywordReviewCount: input.keywordReviews.length,
  keywordReviewFailedCount: input.keywordReviews.filter((review) => review.status === "failed").length,
  keywordReviewAutomationBlockedCount: input.keywordReviews.filter((review) => review.status === "failed").length,
  searchResultCount: input.searchResults.length,
  uniqueProductDetailCount: input.products.length,
  reviewCount: [...input.reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0),
  exceptionCount: input.exceptions.length,
  manualRequiredCount: input.manualRequiredItems.count,
  failedCount: input.failedItems.count,
  packageCompletenessStatus: input.manualRequiredItems.count === 0 && input.failedItems.count === 0 ? "complete" : "incomplete",
  reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
});

const resolveReviewRestriction = (input: {
  product: AmazonProductDetail;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
}): "max_pages_limit" | "manual_required" | null => input.reviewArtifact?.warnings.some((warning) => warning.includes("maxPages"))
  ? "max_pages_limit"
  : input.product.status === "manual_required" ? "manual_required" : null;

const buildCompletenessSignalFlags = (input: {
  product: AmazonProductDetail;
  reviewRows: readonly AmazonReviewRecord[];
  reviewMaxPages: number | undefined;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
}) => ({
  reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
  reviewRestriction: resolveReviewRestriction({ product: input.product, reviewArtifact: input.reviewArtifact }),
  manualRequired: input.product.status === "manual_required",
  hasRawDetailText: Boolean(input.product.rawVisibleTextSnapshot),
  hasMainImage: Boolean(input.product.mainImage),
  hasGalleryImages: input.product.allVisibleImages.length > 0,
  hasBulletPoints: input.product.bulletPoints.length > 0,
  hasDescription: Boolean(input.product.productDescription || input.product.aboutThisItem),
  hasTechnicalDetails: Boolean(input.product.technicalDetails || input.product.productInformation),
  hasReviews: input.reviewRows.length > 0,
  hasReviewRawText: input.reviewRows.some((review) => Boolean(review.rawReviewTextSnapshot)),
});

const buildCompletenessDisclosureFields = (input: {
  productArtifact: AmazonPackageProductEvidence | undefined;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
}) => ({
  missingFields: input.productArtifact?.missingFields ?? [],
  notPresentFields: input.productArtifact?.notPresentFields ?? [],
  blockedFields: input.productArtifact?.blockedFields ?? [],
  unsupportedFields: input.productArtifact?.unsupportedFields ?? [],
  manualRequiredFields: input.productArtifact?.manualRequiredFields ?? [],
  failedFields: input.productArtifact?.failedFields ?? [],
  extractorMissingFields: input.productArtifact?.extractorMissingFields ?? [],
  dataCompletenessScore: input.productArtifact?.completenessScore ?? 0,
  warnings: [...(input.productArtifact?.warnings ?? []), ...(input.reviewArtifact?.warnings ?? [])],
});

const buildCompletenessProductRow = (input: {
  product: AmazonProductDetail;
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  productArtifactsByDetailId: Map<string, AmazonPackageProductEvidence>;
  reviewArtifactsByDetailId: Map<string, AmazonPackageReviewEvidence>;
  reviewMaxPages?: number;
}) => {
  const reviewRows = input.reviewsByDetailId.get(input.product.detailId) ?? [];
  const productArtifact = input.productArtifactsByDetailId.get(input.product.detailId);
  const reviewArtifact = input.reviewArtifactsByDetailId.get(input.product.detailId);
  return {
    detailId: input.product.detailId,
    asin: input.product.asin,
    detailStatus: input.product.status,
    reviewStatus: reviewArtifact?.reviewStatus ?? input.product.status,
    reviewPagesVisited: reviewArtifact?.pagesVisited ?? 0,
    ...buildCompletenessSignalFlags({
      product: input.product,
      reviewRows,
      reviewMaxPages: input.reviewMaxPages,
      reviewArtifact,
    }),
    ...buildCompletenessDisclosureFields({ productArtifact, reviewArtifact }),
  };
};

export const buildCompletenessReport = (input: {
  taskId: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  keywordReviews: readonly AmazonKeywordOpportunityReviewRecord[];
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
    summary: buildCompletenessSummary(input),
    products: input.products.map((product) => buildCompletenessProductRow({
      product,
      reviewsByDetailId: input.reviewsByDetailId,
      productArtifactsByDetailId,
      reviewArtifactsByDetailId,
      ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
    })),
  };
};
