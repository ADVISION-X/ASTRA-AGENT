import { taskRecordToResult, type AmazonTaskResult } from "./amazon-product-mining.result.js";
import { buildFailedTaskRecord } from "./amazon-product-mining.flow-state.js";
import type {
  AmazonKeywordOpportunityReviewRecord,
  AmazonMiningInput,
  AmazonProductDetail,
  AmazonTaskRecord,
} from "./amazon-product-mining.schema.js";

type AmazonFlowControlStorage = {
  getKeywordOpportunityReview(reviewId: string): AmazonKeywordOpportunityReviewRecord | null;
  getProductDetail(detailId: string): AmazonProductDetail | null;
  getSearchResultProductLinksForTask(taskId: string): Array<{ itemId: string; detailId: string }>;
  getTask(taskId: string): AmazonTaskRecord | null;
  listKeywordOpportunityReviews(input?: { taskId?: string }): AmazonKeywordOpportunityReviewRecord[];
};

type AmazonFlowControlRuntime = {
  miningInput: AmazonMiningInput;
  storage: AmazonFlowControlStorage;
  taskId: string;
};

export type AmazonFlowControlState = "active" | "paused" | "terminated";
export type AmazonFlowHaltResult = { kind: "halted"; result: AmazonTaskResult };

export const toAmazonTaskResult = (runtime: AmazonFlowControlRuntime): AmazonTaskResult =>
  taskRecordToResult(runtime.storage.getTask(runtime.taskId) ?? buildFailedTaskRecord({
    taskId: runtime.taskId,
    miningInput: runtime.miningInput,
    message: "task_record_missing",
  }));

export const getAmazonFlowControlState = (runtime: AmazonFlowControlRuntime): AmazonFlowControlState => {
  const task = runtime.storage.getTask(runtime.taskId);
  if (task?.status === "paused") return "paused";
  if (task?.status === "terminated") return "terminated";
  return "active";
};

export const haltIfAmazonOperatorControlled = (runtime: AmazonFlowControlRuntime): AmazonFlowHaltResult | null => {
  const state = getAmazonFlowControlState(runtime);
  return state === "active" ? null : { kind: "halted", result: toAmazonTaskResult(runtime) };
};

export const hasAmazonKeywordOpportunityReview = (
  runtime: AmazonFlowControlRuntime,
  keywordId: string,
): boolean => runtime.storage.listKeywordOpportunityReviews({ taskId: runtime.taskId })
  .some((review) => review.keywordId === keywordId);

export const getAmazonLinkedProductDetail = (
  runtime: AmazonFlowControlRuntime,
  itemId: string,
): AmazonProductDetail | null => {
  const link = runtime.storage.getSearchResultProductLinksForTask(runtime.taskId)
    .find((candidate) => candidate.itemId === itemId);
  return link ? runtime.storage.getProductDetail(link.detailId) : null;
};
