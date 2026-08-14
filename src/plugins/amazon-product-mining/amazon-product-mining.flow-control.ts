import { taskRecordToResult, type AmazonTaskResult } from "./amazon-product-mining.result.js";
import { buildFailedTaskRecord } from "./amazon-product-mining.flow-state.js";
import type {
  AmazonKeywordOpportunityReviewRecord,
  AmazonMiningInput,
  AmazonProductDetail,
  AmazonTaskRecord,
} from "./amazon-product-mining.schema.js";
import type { PluginInterventionSnapshot } from "../../types/plugin-intervention.js";

type AmazonFlowControlStorage = {
  getKeywordOpportunityReview(reviewId: string): AmazonKeywordOpportunityReviewRecord | null;
  getProductDetail(detailId: string): AmazonProductDetail | null;
  getSearchResultProductLinksForTask(taskId: string): Array<{ itemId: string; detailId: string }>;
  getTask(taskId: string): AmazonTaskRecord | null;
  listKeywordOpportunityReviews(input?: { taskId?: string }): AmazonKeywordOpportunityReviewRecord[];
  getIntervention(taskId: string): PluginInterventionSnapshot | null;
  acknowledgeIntervention(taskId: string, checkpoint: string): PluginInterventionSnapshot;
};

type AmazonFlowControlRuntime = {
  ctx: {
    browser: { releaseTargetForOperator?: (input: { reason: string }) => Promise<unknown>; getTarget?: () => unknown };
    aiInputGateway: { releaseProviderTargetForOperator?: (ownerKey: string) => Promise<boolean> };
  };
  miningInput: AmazonMiningInput;
  storage: AmazonFlowControlStorage;
  taskId: string;
};

export type AmazonFlowHaltResult = { kind: "halted"; result: AmazonTaskResult };

export const toAmazonTaskResult = (runtime: AmazonFlowControlRuntime): AmazonTaskResult =>
  taskRecordToResult(runtime.storage.getTask(runtime.taskId) ?? buildFailedTaskRecord({
    taskId: runtime.taskId,
    miningInput: runtime.miningInput,
    message: "task_record_missing",
  }));

export const haltIfAmazonOperatorControlled = async (runtime: AmazonFlowControlRuntime): Promise<AmazonFlowHaltResult | null> => {
  const intervention = runtime.storage.getIntervention(runtime.taskId);
  if (!intervention || intervention.state === "running") return null;
  if (intervention.state === "pause_requested" || intervention.state === "cancel_requested" || intervention.state === "takeover_requested") {
    const acknowledged = runtime.storage.acknowledgeIntervention(runtime.taskId, runtime.storage.getTask(runtime.taskId)?.status ?? "unknown");
    if (acknowledged.state === "taken_over" && runtime.ctx.browser.getTarget?.()) {
      await runtime.ctx.browser.releaseTargetForOperator?.({ reason: `operator takeover for amazon-product-mining:${runtime.taskId}` });
    }
    if (acknowledged.state === "taken_over") {
      await runtime.ctx.aiInputGateway.releaseProviderTargetForOperator?.(`amazon-product-mining:${runtime.taskId}`);
    }
  }
  return { kind: "halted", result: toAmazonTaskResult(runtime) };
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
