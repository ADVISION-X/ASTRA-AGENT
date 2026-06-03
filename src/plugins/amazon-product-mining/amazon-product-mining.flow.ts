import { randomUUID } from "node:crypto";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonKeywordRecord, AmazonMiningInput, AmazonProductDetail, AmazonSearchResultItem } from "./amazon-product-mining.schema.js";
import { createAmazonMiningLogger } from "./amazon-product-mining.logging.js";
import { runProductDetailExtraction } from "./amazon-product-mining.product-detail.js";
import { taskRecordToResult } from "./amazon-product-mining.result.js";
import { runReviewPagination } from "./amazon-product-mining.reviews.js";
import { runAmazonSearch } from "./amazon-product-mining.search.js";
import { buildFailedTaskRecord } from "./amazon-product-mining.flow-state.js";
import { createAmazonMiningStorage } from "./amazon-product-mining.storage.js";
import { buildKeywordRecords, runKeywordGeneration } from "./amazon-product-mining.keyword.js";
import { runKeywordOpportunityReview } from "./amazon-product-mining.keyword-review.js";
import type { AmazonKeywordProviderKind } from "./amazon-product-mining.schema.js";
import {
  openDedicatedAmazonMiningTab,
  recordSearchFailure,
  resolveAmazonItemAsin,
  selectAmazonMiningPacingDelayMs,
  selectSearchItemsForDetailMining as selectSearchItemsForDetailMiningByLimit,
  waitForAmazonMiningPacingDelay,
} from "./amazon-product-mining.flow-support.js";
import { finalizeAmazonMiningPackaging } from "./amazon-product-mining.flow-packaging.js";
import {
  getAmazonLinkedProductDetail,
  haltIfAmazonOperatorControlled,
  hasAmazonKeywordOpportunityReview,
  toAmazonTaskResult,
} from "./amazon-product-mining.flow-control.js";
export { selectAmazonMiningPacingDelayMs };
export type AmazonFlowContext = {
  miningInput: AmazonMiningInput;
  taskId: string;
  dataDir: string;
  browser: BrowserController;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  providerKind: AmazonKeywordProviderKind;
  reviewMaxPages?: number;
};
export type AmazonFlowResult = {
  taskId: string;
  status: string;
  failureReason: string | null;
  packageJsonPath: string | null;
  pdfReportPath: string | null;
  evidenceIndexPath: string | null;
  exceptionSummaryPath: string | null;
  handoffStatus: string;
  runConfig: object;
  completedAt: string | null;
};
type AmazonFlowRuntime = {
  ctx: AmazonFlowContext;
  storage: ReturnType<typeof createAmazonMiningStorage>;
  logger: ReturnType<typeof createAmazonMiningLogger>;
  taskId: string;
  miningInput: AmazonMiningInput;
  dataDir: string;
  manualRequiredReasons: string[];
  failureReasons: string[];
};
type KeywordPhaseResult = { kind: "stop"; result: AmazonFlowResult } | { kind: "continue"; keywordRecords: ReturnType<typeof buildKeywordRecords> };
type MiningPhaseResult = { kind: "active" } | { kind: "halted"; result: AmazonFlowResult };
type KeywordWorkResult = "active" | "halted";
export const AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT = 30;
export const AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE = { min: 1_000, max: 20_000 } as const;
export const AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE = { min: 1_000, max: 5_000 } as const;

const waitForProductDetailOpenPacingDelay = async (runtime: AmazonFlowRuntime): Promise<void> =>
  waitForAmazonMiningPacingDelay(runtime.ctx.browser, AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE);

const waitForReviewPageOpenPacingDelay = async (runtime: AmazonFlowRuntime): Promise<void> =>
  waitForAmazonMiningPacingDelay(runtime.ctx.browser, AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE);

const findExistingDetailForSearchItem = (
  runtime: AmazonFlowRuntime,
  item: { productUrl: string },
  asin: string,
): AmazonProductDetail | null => runtime.storage.getProductDetailsForTask(runtime.taskId)
  .find((detail) => (detail.asin !== null && detail.asin === asin) || detail.productUrl === item.productUrl) ?? null;

const linkExistingDetailForSearchItem = async (
  runtime: AmazonFlowRuntime,
  item: { itemId: string },
  existingDetail: AmazonProductDetail,
): Promise<KeywordWorkResult> => {
  runtime.storage.persistProductDetail(existingDetail, [item.itemId]);
  if (existingDetail.asin && existingDetail.status !== "completed") {
    await extractAndPersistReviews(runtime, existingDetail.detailId, existingDetail.asin);
    return haltIfAmazonOperatorControlled(runtime) ? "halted" : "active";
  }
  return "active";
};

const createAmazonFlowRuntime = (ctx: AmazonFlowContext): AmazonFlowRuntime => ({
  ctx,
  storage: createAmazonMiningStorage(ctx.dataDir),
  logger: createAmazonMiningLogger(ctx.runtimeLogger),
  taskId: ctx.taskId,
  miningInput: ctx.miningInput,
  dataDir: ctx.dataDir,
  manualRequiredReasons: [],
  failureReasons: [],
});

const ensureTaskRecord = (runtime: AmazonFlowRuntime): void => {
  const { storage, logger, taskId, miningInput } = runtime;
  const existingTask = storage.getTask(taskId);
  if (existingTask) {
    if (existingTask.status === "paused") {
      storage.updateTaskStatus({ taskId, status: "mining" });
    }
    return;
  }
  storage.createTask({
    taskId,
    amazonMarketplace: miningInput.amazonMarketplace,
    targetMarket: miningInput.targetMarket,
    productDirection: miningInput.productDirection,
    requestedKeywordCount: miningInput.requestedKeywordCount,
    languagePreference: miningInput.languagePreference ?? "en",
    providerKind: miningInput.providerKind,
    status: "created",
    failureReason: null,
    packageJsonPath: null,
    pdfReportPath: null,
    evidenceIndexPath: null,
    exceptionSummaryPath: null,
    handoffStatus: "not_started",
    createdAt: new Date().toISOString(),
    updatedAt: null,
  });
  logger.logMissionStart({ taskId, marketplace: miningInput.amazonMarketplace });
};

const runKeywordPhase = async (runtime: AmazonFlowRuntime): Promise<KeywordPhaseResult> => {
  const { ctx, storage, logger, taskId, miningInput } = runtime;
  const persistedKeywords = storage.getKeywordsForTask(taskId);
  if (persistedKeywords.length > 0) {
    storage.updateTaskStatus({ taskId, status: "keyword_ready" });
    return { kind: "continue", keywordRecords: persistedKeywords };
  }
  storage.updateTaskStatus({ taskId, status: "keyword_generating" });
  const existingMinedKeywords = storage.getMinedKeywordHistoryForDedup({
    amazonMarketplace: miningInput.amazonMarketplace,
    targetMarket: miningInput.targetMarket,
  });

  logger.logKeywordAiSend({ taskId, runId: taskId });
  const keywordResult = await runKeywordGeneration({
    miningInput,
    taskId,
    existingMinedKeywords,
    aiInputGateway: ctx.aiInputGateway,
    providerKind: ctx.providerKind,
  });
  if (keywordResult.status === "success") {
    logger.logKeywordAiCapture({ taskId, runId: keywordResult.runId, rawLength: keywordResult.rawResponse.length });
  }

  for (const run of keywordResult.runs) {
    storage.saveAiKeywordRun({
      runId: run.runId,
      taskId,
      promptText: run.promptText,
      rawResponse: run.rawResponse,
      parsedKeywords: run.parsedKeywords,
      dedupedKeywords: run.dedupedKeywords,
      status: run.status,
      failureReason: run.failureReason,
    });
  }

  if (keywordResult.status === "failed" || keywordResult.dedupedKeywords.length === 0) {
    const reason = keywordResult.failureReason ?? "keyword_generation_returned_zero_keywords";
    storage.updateTaskStatus({ taskId, status: "failed", failureReason: reason });
    logger.logFailure({ taskId, scope: "keyword_generation", reason });
    return { kind: "stop", result: taskRecordToResult(storage.getTask(taskId)!) };
  }

  logger.logKeywordParsed({
    taskId,
    runId: keywordResult.runId,
    parsedCount: keywordResult.parsedKeywords.length,
    dedupedCount: keywordResult.dedupedKeywords.length,
  });

  const keywordRecords = buildKeywordRecords({
    taskId,
    keywords: keywordResult.dedupedKeywords,
    aiRunId: keywordResult.runId,
  });
  storage.saveKeywords(keywordRecords);
  storage.updateTaskStatus({ taskId, status: "keyword_ready" });
  logger.logKeywordQueuePersisted({ taskId, count: keywordRecords.length });
  return { kind: "continue", keywordRecords };
};

const extractAndPersistReviews = async (
  runtime: AmazonFlowRuntime,
  detailId: string,
  asin: string,
): Promise<void> => {
  const { ctx, storage, logger, taskId, miningInput } = runtime;
  const reviewsUrl = `https://www.${miningInput.amazonMarketplace}/product-reviews/${asin}`;
  storage.updateProductStatus({ detailId, status: "review_extracting" });
  await waitForReviewPageOpenPacingDelay(runtime);
  if (haltIfAmazonOperatorControlled(runtime)) return;

  const paginationResult = await runReviewPagination({
    browser: ctx.browser,
    reviewsUrl,
    detailId,
    taskId,
    asin,
    ...(ctx.reviewMaxPages !== undefined ? { maxPages: ctx.reviewMaxPages } : {}),
    onPageExtracted: async (reviews, pageIndex) => {
      logger.logReviewPageOpen({ taskId, detailId, pageIndex });
      logger.logReviewPageExtracted({ taskId, detailId, pageIndex, count: reviews.length });
      storage.persistReviews(reviews);
      logger.logReviewPagePersisted({ taskId, detailId, pageIndex, count: reviews.length });
    },
  });

  if (paginationResult.restriction === "blocked") {
    runtime.failureReasons.push(`reviews_restricted:detailId=${detailId}`);
    storage.updateProductStatus({ detailId, status: "completed_with_errors" });
    logger.logFailure({ taskId, scope: "reviews", scopeId: detailId, reason: "review_page_blocked" });
    return;
  }

  storage.updateProductStatus({ detailId, status: "completed" });
};

const shouldSkipLinkedDetail = (detail: AmazonProductDetail): boolean =>
  detail.status === "completed"
  || detail.status === "completed_with_errors"
  || detail.status === "manual_required"
  || detail.status === "failed";

const processSearchItem = async (runtime: AmazonFlowRuntime, item: { itemId: string; productUrl: string | null; asinIfAvailable: string | null }): Promise<KeywordWorkResult> => {
  if (haltIfAmazonOperatorControlled(runtime)) return "halted";
  if (!item.productUrl) return "active";
  const linkedDetail = getAmazonLinkedProductDetail(runtime, item.itemId);
  if (linkedDetail) {
    if (shouldSkipLinkedDetail(linkedDetail)) {
      return "active";
    }
    if (linkedDetail.asin && (linkedDetail.status === "pending_detail" || linkedDetail.status === "detail_completed" || linkedDetail.status === "review_extracting")) {
      await extractAndPersistReviews(runtime, linkedDetail.detailId, linkedDetail.asin);
      return haltIfAmazonOperatorControlled(runtime) ? "halted" : "active";
    }
  }
  const asin = resolveAmazonItemAsin(item.productUrl, item.asinIfAvailable);
  const existingDetail = findExistingDetailForSearchItem(runtime, { productUrl: item.productUrl }, asin);
  if (existingDetail) {
    return linkExistingDetailForSearchItem(runtime, item, existingDetail);
  }
  const productDetail = await extractAndPersistProductDetail(runtime, item.itemId, item.productUrl, asin);
  if (!productDetail) return "active";
  if (!productDetail.asin) {
    runtime.storage.updateProductStatus({ detailId: productDetail.detailId, status: "detail_completed" });
    return "active";
  }
  await extractAndPersistReviews(runtime, productDetail.detailId, productDetail.asin);
  return haltIfAmazonOperatorControlled(runtime) ? "halted" : "active";
};

export const selectSearchItemsForDetailMining = <T extends { rankPosition: number }>(
  items: readonly T[],
): T[] => selectSearchItemsForDetailMiningByLimit(items, AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT);

const loadOrSearchKeywordItems = async (
  runtime: AmazonFlowRuntime,
  keywordRecord: AmazonKeywordRecord,
): Promise<AmazonSearchResultItem[]> => {
  const { ctx, storage, logger, taskId, miningInput } = runtime;
  let searchItems: AmazonSearchResultItem[] = storage.getSearchResultsForKeyword(keywordRecord.keywordId);
  if (searchItems.length === 0 && keywordRecord.status !== "failed" && keywordRecord.status !== "manual_required") {
    storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "searching" });
    logger.logSearchOpen({ taskId, keywordId: keywordRecord.keywordId, keyword: keywordRecord.keyword });

    const searchResult = await runAmazonSearch({
      browser: ctx.browser,
      marketplace: miningInput.amazonMarketplace,
      keywordId: keywordRecord.keywordId,
      keyword: keywordRecord.keyword,
      taskId,
    });

    if (!searchResult.ok) {
      recordSearchFailure(runtime, keywordRecord.keywordId, searchResult.blockerKind, searchResult.reason);
    } else {
      logger.logSearchExtracted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });
      storage.persistSearchResults(searchResult.items);
      logger.logSearchPersisted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });
      storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "search_completed" });
      searchItems = searchResult.items;
    }
  }
  return searchItems;
};

const processKeywordSearchItems = async (
  runtime: AmazonFlowRuntime,
  keywordRecord: AmazonKeywordRecord,
  searchItems: readonly AmazonSearchResultItem[],
): Promise<KeywordWorkResult> => {
  if (searchItems.length > 0) {
    runtime.storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "search_completed" });
    for (const item of selectSearchItemsForDetailMining(searchItems)) {
      const itemResult = await processSearchItem(runtime, item);
      if (itemResult === "halted") return "halted";
    }
    runtime.storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "completed" });
  }
  return "active";
};

const persistRejectedKeywordRetentionNote = (
  runtime: AmazonFlowRuntime,
  keywordReview: Awaited<ReturnType<typeof runKeywordOpportunityReview>>,
): void => {
  const { storage } = runtime;
  if (keywordReview.status === "completed" && keywordReview.decision === "REJECT") {
    storage.saveKeywordOpportunityReview({
      ...keywordReview,
      evidenceRefs: [...keywordReview.evidenceRefs, "rejected_keyword_evidence_retained"],
      riskPoints: [
        ...keywordReview.riskPoints,
        "Rejected keyword evidence retained for human and advanced-AI review; REJECT only removes the keyword from candidate screening.",
      ],
      updatedAt: new Date().toISOString(),
    });
  }
};

const runKeywordReviewIfNeeded = async (
  runtime: AmazonFlowRuntime,
  keywordRecord: AmazonKeywordRecord,
): Promise<void> => {
  if (hasAmazonKeywordOpportunityReview(runtime, keywordRecord.keywordId)) return;
  const { ctx, storage, taskId } = runtime;
  const keywordReview = await runKeywordOpportunityReview({
    dataDir: runtime.dataDir,
    taskId,
    keyword: storage.getKeywordsForTask(taskId).find((record) => record.keywordId === keywordRecord.keywordId) ?? keywordRecord,
    storage,
    aiInputGateway: ctx.aiInputGateway,
  });
  if (keywordReview.status === "failed") runtime.failureReasons.push(`keyword_review_failed:${keywordRecord.keywordId}`);
  persistRejectedKeywordRetentionNote(runtime, keywordReview);
};

const processKeywordRecord = async (
  runtime: AmazonFlowRuntime,
  keywordRecord: AmazonKeywordRecord,
): Promise<KeywordWorkResult> => {
  if (haltIfAmazonOperatorControlled(runtime)) return "halted";
  const searchItems = await loadOrSearchKeywordItems(runtime, keywordRecord);
  const itemResult = await processKeywordSearchItems(runtime, keywordRecord, searchItems);
  if (itemResult === "halted" || haltIfAmazonOperatorControlled(runtime)) return "halted";
  await runKeywordReviewIfNeeded(runtime, keywordRecord);
  return haltIfAmazonOperatorControlled(runtime) ? "halted" : "active";
};

const extractAndPersistProductDetail = async (
  runtime: AmazonFlowRuntime,
  itemId: string,
  productUrl: string,
  asin: string,
) => {
  const { ctx, storage, logger, taskId } = runtime;
  await waitForProductDetailOpenPacingDelay(runtime);
  if (haltIfAmazonOperatorControlled(runtime)) return null;
  logger.logDetailOpen({ taskId, detailId: itemId, productUrl });

  try {
    const productDetail = await runProductDetailExtraction({
      browser: ctx.browser,
      productUrl,
      asin,
      taskId,
    });
    logger.logDetailExtracted({ taskId, detailId: productDetail.detailId });
    storage.persistProductDetail(productDetail, [itemId]);
    logger.logDetailPersisted({ taskId, detailId: productDetail.detailId });
    return productDetail;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    storage.persistException({
      exceptionId: randomUUID(),
      taskId,
      scope: "product_detail",
      scopeId: itemId,
      exceptionKind: "detail_extraction_failed",
      message,
    });
    logger.logFailure({ taskId, scope: "product_detail", scopeId: itemId, reason: message });
    return null;
  }
};

const openDedicatedMiningTab = async (runtime: AmazonFlowRuntime): Promise<void> => {
  await openDedicatedAmazonMiningTab(runtime.ctx.browser, runtime.taskId);
};

const runMiningPhase = async (
  runtime: AmazonFlowRuntime,
  keywordRecords: readonly AmazonKeywordRecord[],
): Promise<MiningPhaseResult> => {
  runtime.storage.updateTaskStatus({ taskId: runtime.taskId, status: "mining" });
  await openDedicatedMiningTab(runtime);
  for (const keywordRecord of keywordRecords) {
    const control = haltIfAmazonOperatorControlled(runtime);
    if (control) return control;
    const result = await processKeywordRecord(runtime, keywordRecord);
    if (result === "halted") return { kind: "halted", result: toAmazonTaskResult(runtime) };
  }
  return { kind: "active" };
};

const buildFailureResult = (runtime: AmazonFlowRuntime, error: unknown): AmazonFlowResult => {
  const message = error instanceof Error ? error.message : String(error);
  runtime.storage.updateTaskStatus({ taskId: runtime.taskId, status: "failed", failureReason: message });
  runtime.logger.logFailure({ taskId: runtime.taskId, scope: "flow", reason: message });
  const failedTask = runtime.storage.getTask(runtime.taskId);
  return taskRecordToResult(failedTask ?? buildFailedTaskRecord({
    taskId: runtime.taskId,
    miningInput: runtime.miningInput,
    message,
  }));
};

export const runAmazonProductMiningFlow = async (ctx: AmazonFlowContext): Promise<AmazonFlowResult> => {
  const runtime = createAmazonFlowRuntime(ctx);

  try {
    ensureTaskRecord(runtime);
    const initialControl = haltIfAmazonOperatorControlled(runtime);
    if (initialControl) return initialControl.result;
    const keywordPhase = await runKeywordPhase(runtime);
    if (keywordPhase.kind === "stop") {
      return keywordPhase.result;
    }
    const miningPhase = await runMiningPhase(runtime, keywordPhase.keywordRecords);
    if (miningPhase.kind === "halted") return miningPhase.result;
    const packagingControl = haltIfAmazonOperatorControlled(runtime);
    if (packagingControl) return packagingControl.result;
    return await finalizeAmazonMiningPackaging(runtime, AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT);
  } catch (error) {
    return buildFailureResult(runtime, error);
  } finally {
    runtime.storage.close();
  }
};
