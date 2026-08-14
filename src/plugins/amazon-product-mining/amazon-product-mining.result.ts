import type { AmazonKeywordRecord, AmazonTaskRecord, AmazonTaskStatus } from "./amazon-product-mining.schema.js";

const COMPLETED_TASK_STATUSES = new Set<AmazonTaskStatus>(["package_completed", "failed", "manual_required", "cancelled", "taken_over"]);

export type AmazonTaskRunConfig = {
  taskId: string;
  amazonMarketplace: string;
  targetMarket: string;
  productDirection: string;
  requestedKeywordCount: number;
  languagePreference: string;
  keywordHistoryPolicy: string;
  createdAt: string;
};

export type AmazonTaskKeywordProgress = {
  keywordId: string;
  keyword: string;
  status: string;
  keywordHistoryRelation: string;
  searchResultCount: number;
  productDetailCount: number;
  reviewCount: number;
};

export type AmazonTaskRunSummary = {
  keywordCount: number;
  searchResultCount: number;
  productDetailCount: number;
  reviewCount: number;
  keywordReviewCount: number;
};

export type AmazonTaskResultSnapshot = {
  keywordReviewCount: number;
  keywords: Array<AmazonTaskKeywordProgress>;
};

export type AmazonTaskResult = {
  taskId: string;
  status: AmazonTaskStatus;
  failureReason: string | null;
  packageJsonPath: string | null;
  pdfReportPath: string | null;
  evidenceIndexPath: string | null;
  exceptionSummaryPath: string | null;
  handoffStatus: string;
  runConfig: AmazonTaskRunConfig;
  keywords: Array<AmazonTaskKeywordProgress>;
  summary: AmazonTaskRunSummary;
  completedAt: string | null;
};

const emptySnapshot = (): AmazonTaskResultSnapshot => ({
  keywordReviewCount: 0,
  keywords: [],
});

const buildSummary = (
  snapshot: AmazonTaskResultSnapshot,
): AmazonTaskRunSummary => ({
  keywordCount: snapshot.keywords.length,
  searchResultCount: snapshot.keywords.reduce((total, keyword) => total + keyword.searchResultCount, 0),
  productDetailCount: snapshot.keywords.reduce((total, keyword) => total + keyword.productDetailCount, 0),
  reviewCount: snapshot.keywords.reduce((total, keyword) => total + keyword.reviewCount, 0),
  keywordReviewCount: snapshot.keywordReviewCount,
});

export const createKeywordProgress = (
  keyword: AmazonKeywordRecord,
  counts: {
    productDetailCount: number;
    reviewCount: number;
    searchResultCount: number;
  },
): AmazonTaskKeywordProgress => ({
  keywordId: keyword.keywordId,
  keyword: keyword.keyword,
  status: keyword.status,
  keywordHistoryRelation: keyword.keywordHistoryRelation,
  searchResultCount: counts.searchResultCount,
  productDetailCount: counts.productDetailCount,
  reviewCount: counts.reviewCount,
});

export const taskRecordToResult = (
  task: AmazonTaskRecord,
  snapshot: AmazonTaskResultSnapshot = emptySnapshot(),
): AmazonTaskResult => ({
  taskId: task.taskId,
  status: task.status,
  failureReason: task.failureReason,
  packageJsonPath: task.packageJsonPath,
  pdfReportPath: task.pdfReportPath,
  evidenceIndexPath: task.evidenceIndexPath,
  exceptionSummaryPath: task.exceptionSummaryPath,
  handoffStatus: task.handoffStatus,
  runConfig: {
    taskId: task.taskId,
    amazonMarketplace: task.amazonMarketplace,
    targetMarket: task.targetMarket,
    productDirection: task.productDirection,
    requestedKeywordCount: task.requestedKeywordCount,
    languagePreference: task.languagePreference,
    keywordHistoryPolicy: task.keywordHistoryPolicy,
    createdAt: task.createdAt,
  },
  keywords: snapshot.keywords,
  summary: buildSummary(snapshot),
  completedAt: COMPLETED_TASK_STATUSES.has(task.status) ? task.updatedAt : null,
});
