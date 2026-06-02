import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import {
  buildCompletenessReport,
  buildImageEvidenceIndex,
  buildStatusItems,
} from "./amazon-product-mining.package-completeness.js";
import {
  buildExceptionScopeMap,
  buildLinkedSearchItemsByDetailId,
  writeAiKeywordRunArtifacts,
} from "./amazon-product-mining.package-build-support.js";
import { buildPackageSchemaArtifact } from "./amazon-product-mining.package-manifest.js";
import {
  writeKeywordEvidenceArtifacts,
  type AmazonPackageKeywordEvidence,
} from "./amazon-product-mining.package-keyword-evidence.js";
import {
  writeProductEvidenceArtifacts,
  type AmazonPackageProductEvidence,
} from "./amazon-product-mining.package-product-evidence.js";
import {
  writeReviewEvidenceArtifacts,
  type AmazonPackageReviewEvidence,
} from "./amazon-product-mining.package-review-evidence.js";
import {
  writeJsonFile,
  type AmazonExceptionRecord,
  type AmazonKeywordRecord,
  type AmazonKeywordOpportunityReviewRecord,
  type AmazonProductDetail,
  type AmazonReviewRecord,
  type AmazonSearchResultItem,
  type AmazonTaskRecord,
} from "./amazon-product-mining.package-artifact-builders.js";
import type { AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";

type AmazonSearchResultProductLink = ReturnType<AmazonMiningStorage["getSearchResultProductLinksForTask"]>[number];

export type PackageRuntimeState = {
  generatedAt: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  keywordReviews: readonly AmazonKeywordOpportunityReviewRecord[];
  aiKeywordRuns: ReturnType<AmazonMiningStorage["getAiKeywordRunsForTask"]>;
  exceptions: readonly AmazonExceptionRecord[];
  links: readonly AmazonSearchResultProductLink[];
  searchResultsByKeyword: Map<string, AmazonSearchResultItem[]>;
  allSearchResults: AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  totalReviews: number;
  detailIdsByItemId: Map<string, string[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
  linkedSearchItemsByDetailId: Map<string, AmazonSearchResultItem[]>;
};

export type PackageEvidenceState = {
  keywordArtifacts: AmazonPackageKeywordEvidence[];
  reviewArtifacts: AmazonPackageReviewEvidence[];
  productArtifacts: AmazonPackageProductEvidence[];
  aiKeywordRunArtifacts: ReturnType<typeof writeAiKeywordRunArtifacts>;
  manualRequiredItems: ReturnType<typeof buildStatusItems>;
  failedItems: ReturnType<typeof buildStatusItems>;
  completenessReport: ReturnType<typeof buildCompletenessReport>;
  imageEvidenceIndex: ReturnType<typeof buildImageEvidenceIndex>;
};

const loadSearchResultsByKeyword = (
  storage: AmazonMiningStorage,
  keywords: readonly AmazonKeywordRecord[],
): Map<string, AmazonSearchResultItem[]> => {
  const searchResultsByKeyword = new Map<string, AmazonSearchResultItem[]>();
  for (const keyword of keywords) {
    searchResultsByKeyword.set(keyword.keywordId, storage.getSearchResultsForKeyword(keyword.keywordId));
  }
  return searchResultsByKeyword;
};

const loadReviewsByDetailId = (
  storage: AmazonMiningStorage,
  products: readonly AmazonProductDetail[],
): Map<string, AmazonReviewRecord[]> => {
  const reviewsByDetailId = new Map<string, AmazonReviewRecord[]>();
  for (const product of products) {
    reviewsByDetailId.set(product.detailId, storage.getReviewsForProduct(product.detailId));
  }
  return reviewsByDetailId;
};

const buildDetailIdsByItemId = (links: readonly AmazonSearchResultProductLink[]): Map<string, string[]> => {
  const detailIdsByItemId = new Map<string, string[]>();
  for (const link of links) {
    const detailIds = detailIdsByItemId.get(link.itemId) ?? [];
    detailIds.push(link.detailId);
    detailIdsByItemId.set(link.itemId, detailIds);
  }
  return detailIdsByItemId;
};

export const loadPackageRuntimeState = (input: {
  taskId: string;
  storage: AmazonMiningStorage;
}): PackageRuntimeState => {
  const generatedAt = new Date().toISOString();
  const task = input.storage.getTask(input.taskId);
  const keywords = input.storage.getKeywordsForTask(input.taskId);
  const keywordReviews = input.storage.listKeywordOpportunityReviews({ taskId: input.taskId });
  const aiKeywordRuns = input.storage.getAiKeywordRunsForTask(input.taskId);
  const exceptions = input.storage.getExceptionsForTask(input.taskId);
  const links = input.storage.getSearchResultProductLinksForTask(input.taskId);
  const searchResultsByKeyword = loadSearchResultsByKeyword(input.storage, keywords);
  const allSearchResults = [...searchResultsByKeyword.values()].flat();
  const products = input.storage.getProductDetailsForTask(input.taskId);
  const reviewsByDetailId = loadReviewsByDetailId(input.storage, products);
  const totalReviews = [...reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0);
  const detailIdsByItemId = buildDetailIdsByItemId(links);
  const exceptionIdsByScopeId = buildExceptionScopeMap(exceptions);
  const linkedSearchItemsByDetailId = buildLinkedSearchItemsByDetailId(allSearchResults, links);
  return {
    generatedAt,
    task,
    keywords,
    keywordReviews,
    aiKeywordRuns,
    exceptions,
    links,
    searchResultsByKeyword,
    allSearchResults,
    products,
    reviewsByDetailId,
    totalReviews,
    detailIdsByItemId,
    exceptionIdsByScopeId,
    linkedSearchItemsByDetailId,
  };
};

export const buildPackageEvidenceState = (input: {
  layout: AmazonPackageLayout;
  runtime: PackageRuntimeState;
  reviewMaxPages?: number;
}): PackageEvidenceState => {
  const keywordArtifacts = writeKeywordEvidenceArtifacts({
    layout: input.layout,
    keywords: input.runtime.keywords,
    searchResultsByKeyword: input.runtime.searchResultsByKeyword,
    detailIdsByItemId: input.runtime.detailIdsByItemId,
    exceptionIdsByScopeId: input.runtime.exceptionIdsByScopeId,
  });
  const reviewArtifacts = writeReviewEvidenceArtifacts({
    layout: input.layout,
    products: input.runtime.products,
    reviewsByDetailId: input.runtime.reviewsByDetailId,
    ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
  });
  const reviewArtifactsByDetailId = new Map(reviewArtifacts.map((artifact) => [artifact.detailId, artifact]));
  const productArtifacts = writeProductEvidenceArtifacts({
    layout: input.layout,
    products: input.runtime.products,
    linkedSearchItemsByDetailId: input.runtime.linkedSearchItemsByDetailId,
    reviewArtifactsByDetailId,
    reviewsByDetailId: input.runtime.reviewsByDetailId,
    exceptionIdsByScopeId: input.runtime.exceptionIdsByScopeId,
  });
  const manualRequiredItems = buildStatusItems({
    task: input.runtime.task,
    keywords: input.runtime.keywords,
    keywordReviews: input.runtime.keywordReviews,
    products: input.runtime.products,
    exceptions: input.runtime.exceptions,
    status: "manual_required",
  });
  const failedItems = buildStatusItems({
    task: input.runtime.task,
    keywords: input.runtime.keywords,
    keywordReviews: input.runtime.keywordReviews,
    products: input.runtime.products,
    exceptions: input.runtime.exceptions,
    status: "failed",
  });
  return {
    keywordArtifacts,
    reviewArtifacts,
    productArtifacts,
    aiKeywordRunArtifacts: writeAiKeywordRunArtifacts({ layout: input.layout, aiKeywordRuns: input.runtime.aiKeywordRuns }),
    manualRequiredItems,
    failedItems,
    completenessReport: buildCompletenessReport({
      taskId: input.runtime.task?.taskId ?? "unknown",
      task: input.runtime.task,
      keywords: input.runtime.keywords,
      keywordReviews: input.runtime.keywordReviews,
      searchResults: input.runtime.allSearchResults,
      products: input.runtime.products,
      reviewsByDetailId: input.runtime.reviewsByDetailId,
      productArtifacts,
      reviewArtifacts,
      exceptions: input.runtime.exceptions,
      manualRequiredItems,
      failedItems,
      ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
    }),
    imageEvidenceIndex: buildImageEvidenceIndex({
      taskId: input.runtime.task?.taskId ?? "unknown",
      searchResults: input.runtime.allSearchResults,
      products: input.runtime.products,
      reviewsByDetailId: input.runtime.reviewsByDetailId,
    }),
  };
};

export const buildTaskScopeArtifact = (input: {
  taskId: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  detailRankLimit?: number;
  reviewMaxPages?: number;
  generatedAt: string;
}) => ({
  taskId: input.task?.taskId ?? input.taskId,
  amazonMarketplace: input.task?.amazonMarketplace ?? "unknown",
  targetMarket: input.task?.targetMarket ?? "unknown",
  productDirection: input.task?.productDirection ?? "unknown",
  requestedKeywordCount: input.task?.requestedKeywordCount ?? input.keywords.length,
  languagePreference: input.task?.languagePreference ?? "en",
  status: input.task?.status ?? "unknown",
  failureReason: input.task?.failureReason ?? null,
  handoffStatus: input.task?.handoffStatus ?? "not_started",
  productDetailRankLimit: input.detailRankLimit ?? null,
  reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
  createdAt: input.task?.createdAt ?? input.generatedAt,
  updatedAt: input.task?.updatedAt ?? null,
});

export const buildExceptionSummaryArtifact = (input: {
  taskId: string;
  exceptions: readonly AmazonExceptionRecord[];
  keywordReviews: readonly AmazonKeywordOpportunityReviewRecord[];
  manualRequiredItems: ReturnType<typeof buildStatusItems>;
  failedItems: ReturnType<typeof buildStatusItems>;
}) => {
  const keywordReviewIssues = input.keywordReviews
    .filter((review) => review.status === "failed" || review.status === "manual_required")
    .map((review) => ({
      scope: "keyword_review",
      scopeId: review.keywordId,
      reviewId: review.reviewId,
      keyword: review.keyword,
      status: review.status,
      reason: review.failureReason,
      aiResponseRef: review.aiResponseRef,
      packageRef: review.packageRef,
    }));
  return {
    taskId: input.taskId,
    totalExceptions: input.exceptions.length + keywordReviewIssues.length,
    manualRequiredCount: input.manualRequiredItems.count,
    failedCount: input.failedItems.count,
    keywordReviewIssueCount: keywordReviewIssues.length,
    exceptions: input.exceptions,
    keywordReviewIssues,
  };
};

export const writePackageSideArtifacts = (input: {
  layout: AmazonPackageLayout;
  taskScope: Record<string, unknown>;
  imageEvidenceIndex: ReturnType<typeof buildImageEvidenceIndex>;
  exceptionSummary: ReturnType<typeof buildExceptionSummaryArtifact>;
  manualRequiredItems: ReturnType<typeof buildStatusItems>;
  failedItems: ReturnType<typeof buildStatusItems>;
  completenessReport: ReturnType<typeof buildCompletenessReport>;
}): void => {
  writeJsonFile(input.layout.taskScopePath, input.taskScope);
  writeJsonFile(input.layout.imageEvidenceIndexPath, input.imageEvidenceIndex);
  writeJsonFile(input.layout.exceptionSummaryPath, input.exceptionSummary);
  writeJsonFile(input.layout.manualRequiredPath, input.manualRequiredItems);
  writeJsonFile(input.layout.failedItemsPath, input.failedItems);
  writeJsonFile(input.layout.dataCompletenessReportPath, input.completenessReport);
  writeJsonFile(input.layout.packageSchemaPath, buildPackageSchemaArtifact());
};
