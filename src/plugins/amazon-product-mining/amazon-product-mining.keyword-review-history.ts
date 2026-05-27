import type {
  AmazonKeywordOpportunityDecision,
  AmazonKeywordOpportunityHumanNextStep,
  AmazonKeywordOpportunityReviewRecord,
  AmazonKeywordOpportunityReviewStatus,
  AmazonKeywordOpportunityStrength,
} from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type AmazonKeywordOpportunityReviewHistoryAvailability = "pass" | "failed" | "not_available";

export type AmazonKeywordOpportunityReviewHistoryEntry = {
  reviewId: string;
  createdAt: string;
  taskId: string;
  marketplace: string | null;
  targetMarket: string | null;
  keyword: string;
  decision: AmazonKeywordOpportunityDecision | null;
  humanNextStep: AmazonKeywordOpportunityHumanNextStep | null;
  demandSignal: AmazonKeywordOpportunityStrength | null;
  reviewHealth: AmazonKeywordOpportunityStrength | null;
  priceCeiling: AmazonKeywordOpportunityStrength | null;
  competitionOpenness: AmazonKeywordOpportunityStrength | null;
  improvementOpportunity: AmazonKeywordOpportunityStrength | null;
  dataConfidence: AmazonKeywordOpportunityStrength | null;
  productCount: number;
  reviewCount: number;
  packageIntegrity: AmazonKeywordOpportunityReviewHistoryAvailability;
  dataCompleteness: AmazonKeywordOpportunityReviewHistoryAvailability;
  status: AmazonKeywordOpportunityReviewStatus;
  packageRef: string | null;
  aiReviewRef: string | null;
  reasonEvidenceSummary: string;
  aiReviewSummary: string;
  evidenceRefs: string[];
  missingEvidence: string[];
  riskPoints: string[];
  masterEvidenceReportRef: string | null;
  dataCompletenessReportRef: string | null;
  packageIntegrityReportRef: string | null;
  exceptionSummaryRef: string | null;
  evidenceIndexRef: string | null;
  aiRawResponseRef: string | null;
};

type TaskReviewContext = {
  task: ReturnType<AmazonMiningStorage["getTask"]>;
  detailIdsByItemId: Map<string, string[]>;
  reviewCountByDetailId: Map<string, number>;
  searchItemsByKeywordId: Map<string, ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>>;
};

const NOT_AVAILABLE: AmazonKeywordOpportunityReviewHistoryAvailability = "not_available";

const firstPresent = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

const collapseInlineText = (value: string): string => value.replaceAll("\r", " ").replaceAll("\n", " ").trim();

const summarizeText = (value: string | null | undefined, maxLength: number): string | null => {
  const present = firstPresent(value);
  if (!present) {
    return null;
  }
  const collapsed = collapseInlineText(present);
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const buildReasonEvidenceSummary = (review: AmazonKeywordOpportunityReviewRecord): string => {
  const summaryParts = [
    ["failure", summarizeText(review.failureReason, 96)],
    ["risk", summarizeText(review.riskPoints[0], 96)],
    ["missing", summarizeText(review.missingEvidence[0], 96)],
    ["evidence", summarizeText(review.evidenceRefs[0], 96)],
    ["review", summarizeText(review.aiRawResponse, 120)],
  ] as const;
  const presentParts = summaryParts
    .filter(([, value]) => value !== null)
    .slice(0, 2)
    .map(([label, value]) => `${label}: ${value}`);
  return presentParts.length > 0 ? presentParts.join(" | ") : NOT_AVAILABLE;
};

const buildAiReviewSummary = (review: AmazonKeywordOpportunityReviewRecord): string =>
  summarizeText(
    firstPresent(
      review.aiRawResponse,
      review.riskPoints[0],
      review.missingEvidence[0],
      review.failureReason,
    ),
    520,
  ) ?? NOT_AVAILABLE;

const getTaskReviewContext = (
  storage: AmazonMiningStorage,
  cache: Map<string, TaskReviewContext>,
  taskId: string,
): TaskReviewContext => {
  const existing = cache.get(taskId);
  if (existing) {
    return existing;
  }

  const detailIdsByItemId = new Map<string, string[]>();
  for (const link of storage.getSearchResultProductLinksForTask(taskId)) {
    const detailIds = detailIdsByItemId.get(link.itemId) ?? [];
    detailIds.push(link.detailId);
    detailIdsByItemId.set(link.itemId, detailIds);
  }

  const reviewCountByDetailId = new Map<string, number>();
  for (const detail of storage.getProductDetailsForTask(taskId)) {
    reviewCountByDetailId.set(detail.detailId, storage.getReviewsForProduct(detail.detailId).length);
  }

  const context: TaskReviewContext = {
    task: storage.getTask(taskId),
    detailIdsByItemId,
    reviewCountByDetailId,
    searchItemsByKeywordId: new Map(),
  };
  cache.set(taskId, context);
  return context;
};

const getSearchItemsForKeyword = (
  storage: AmazonMiningStorage,
  context: TaskReviewContext,
  keywordId: string,
): ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]> => {
  const existing = context.searchItemsByKeywordId.get(keywordId);
  if (existing) {
    return existing;
  }
  const items = storage.getSearchResultsForKeyword(keywordId);
  context.searchItemsByKeywordId.set(keywordId, items);
  return items;
};

const buildKeywordCounts = (
  storage: AmazonMiningStorage,
  context: TaskReviewContext,
  review: AmazonKeywordOpportunityReviewRecord,
): { productCount: number; reviewCount: number } => {
  const searchItems = getSearchItemsForKeyword(storage, context, review.keywordId);
  const detailIds = new Set<string>();

  for (const item of searchItems) {
    for (const detailId of context.detailIdsByItemId.get(item.itemId) ?? []) {
      detailIds.add(detailId);
    }
  }

  let reviewCount = 0;
  for (const detailId of detailIds) {
    reviewCount += context.reviewCountByDetailId.get(detailId) ?? 0;
  }

  return {
    productCount: detailIds.size > 0 ? detailIds.size : searchItems.length,
    reviewCount,
  };
};

const buildHistoryEntryBase = (input: {
  review: AmazonKeywordOpportunityReviewRecord;
  task: TaskReviewContext["task"];
}): Pick<
  AmazonKeywordOpportunityReviewHistoryEntry,
  "reviewId" | "createdAt" | "taskId" | "marketplace" | "targetMarket" | "keyword" | "status"
> => ({
  reviewId: input.review.reviewId,
  createdAt: input.review.createdAt,
  taskId: input.review.taskId,
  marketplace: input.task?.amazonMarketplace ?? null,
  targetMarket: input.task?.targetMarket ?? null,
  keyword: input.review.keyword,
  status: input.review.status,
});

const buildHistoryEntryAssessment = (input: {
  review: AmazonKeywordOpportunityReviewRecord;
  counts: { productCount: number; reviewCount: number };
}): Pick<
  AmazonKeywordOpportunityReviewHistoryEntry,
  | "decision"
  | "humanNextStep"
  | "demandSignal"
  | "reviewHealth"
  | "priceCeiling"
  | "competitionOpenness"
  | "improvementOpportunity"
  | "dataConfidence"
  | "productCount"
  | "reviewCount"
  | "packageIntegrity"
  | "dataCompleteness"
  | "reasonEvidenceSummary"
  | "aiReviewSummary"
  | "evidenceRefs"
  | "missingEvidence"
  | "riskPoints"
> => ({
  decision: input.review.decision,
  humanNextStep: input.review.humanNextStep,
  demandSignal: input.review.demandSignal,
  reviewHealth: input.review.reviewHealth,
  priceCeiling: input.review.priceCeiling,
  competitionOpenness: input.review.competitionOpenness,
  improvementOpportunity: input.review.improvementOpportunity,
  dataConfidence: input.review.dataConfidence,
  productCount: input.counts.productCount,
  reviewCount: input.counts.reviewCount,
  packageIntegrity: NOT_AVAILABLE,
  dataCompleteness: NOT_AVAILABLE,
  reasonEvidenceSummary: buildReasonEvidenceSummary(input.review),
  aiReviewSummary: buildAiReviewSummary(input.review),
  evidenceRefs: input.review.evidenceRefs,
  missingEvidence: input.review.missingEvidence,
  riskPoints: input.review.riskPoints,
});

const buildHistoryEntryArtifacts = (input: {
  review: AmazonKeywordOpportunityReviewRecord;
  task: TaskReviewContext["task"];
}): Pick<
  AmazonKeywordOpportunityReviewHistoryEntry,
  | "packageRef"
  | "aiReviewRef"
  | "masterEvidenceReportRef"
  | "dataCompletenessReportRef"
  | "packageIntegrityReportRef"
  | "exceptionSummaryRef"
  | "evidenceIndexRef"
  | "aiRawResponseRef"
> => ({
  packageRef: firstPresent(input.review.keywordPackageSliceRef, input.review.packageRef, input.task?.packageJsonPath ?? null),
  aiReviewRef: input.review.aiResponseRef,
  masterEvidenceReportRef: input.task?.pdfReportPath ?? null,
  dataCompletenessReportRef: null,
  packageIntegrityReportRef: null,
  exceptionSummaryRef: input.task?.exceptionSummaryPath ?? null,
  evidenceIndexRef: input.task?.evidenceIndexPath ?? null,
  aiRawResponseRef: input.review.aiResponseRef,
});

const toHistoryEntry = (
  storage: AmazonMiningStorage,
  cache: Map<string, TaskReviewContext>,
  review: AmazonKeywordOpportunityReviewRecord,
): AmazonKeywordOpportunityReviewHistoryEntry => {
  const context = getTaskReviewContext(storage, cache, review.taskId);
  const counts = buildKeywordCounts(storage, context, review);
  const task = context.task;
  return {
    ...buildHistoryEntryBase({ review, task }),
    ...buildHistoryEntryAssessment({ review, counts }),
    ...buildHistoryEntryArtifacts({ review, task }),
  };
};

export const listAmazonProductMiningKeywordReviewHistory = (
  storage: AmazonMiningStorage,
  input?: { taskId?: string },
): AmazonKeywordOpportunityReviewHistoryEntry[] => {
  const cache = new Map<string, TaskReviewContext>();
  return storage
    .listKeywordOpportunityReviews(input?.taskId ? { taskId: input.taskId } : {})
    .map((review) => toHistoryEntry(storage, cache, review));
};

export const getAmazonProductMiningKeywordReviewHistoryEntry = (
  storage: AmazonMiningStorage,
  reviewId: string,
): AmazonKeywordOpportunityReviewHistoryEntry | null => {
  const review = storage.getKeywordOpportunityReview(reviewId);
  if (!review) {
    return null;
  }
  return toHistoryEntry(storage, new Map<string, TaskReviewContext>(), review);
};