import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonMiningInput } from "./amazon-product-mining.schema.js";
import { writeAmazonHandoffRecord } from "./amazon-product-mining.handoff.js";
import { createAmazonMiningLogger } from "./amazon-product-mining.logging.js";
import { buildAmazonProductMiningPackage } from "./amazon-product-mining.package.js";
import { buildAmazonProductMiningReport } from "./amazon-product-mining.pdf.js";
import { runProductDetailExtraction } from "./amazon-product-mining.product-detail.js";
import { taskRecordToResult } from "./amazon-product-mining.result.js";
import { runReviewPagination } from "./amazon-product-mining.reviews.js";
import { runAmazonSearch } from "./amazon-product-mining.search.js";
import { createAmazonMiningStorage } from "./amazon-product-mining.storage.js";
import { buildKeywordRecords, runKeywordGeneration } from "./amazon-product-mining.keyword.js";
import type { AmazonKeywordProviderKind } from "./amazon-product-mining.schema.js";

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
};

type KeywordPhaseResult =
  | { kind: "stop"; result: AmazonFlowResult }
  | { kind: "continue"; keywordRecords: ReturnType<typeof buildKeywordRecords> };

type PackageBuildResult = Awaited<ReturnType<typeof buildAmazonProductMiningPackage>>;

type PackagingArtifacts = {
  packageResult: PackageBuildResult;
  pdfPath: string | null;
};

type FinalTaskResolution = {
  finalTaskStatus: "failed" | "manual_required" | "package_completed";
  finalHandoffStatus: "ready" | "failed";
  finalFailureReason: string | null;
};

const createAmazonFlowRuntime = (ctx: AmazonFlowContext): AmazonFlowRuntime => ({
  ctx,
  storage: createAmazonMiningStorage(ctx.dataDir),
  logger: createAmazonMiningLogger(ctx.runtimeLogger),
  taskId: ctx.taskId,
  miningInput: ctx.miningInput,
  dataDir: ctx.dataDir,
  manualRequiredReasons: [],
});

const buildPackageInput = (runtime: AmazonFlowRuntime) => ({
  taskId: runtime.taskId,
  dataDir: runtime.dataDir,
  storage: runtime.storage,
  ...(runtime.ctx.reviewMaxPages !== undefined ? { reviewMaxPages: runtime.ctx.reviewMaxPages } : {}),
});

const createTaskRecord = (runtime: AmazonFlowRuntime): void => {
  const { storage, logger, taskId, miningInput } = runtime;
  storage.createTask({
    taskId,
    amazonMarketplace: miningInput.amazonMarketplace,
    targetMarket: miningInput.targetMarket,
    productDirection: miningInput.productDirection,
    requestedKeywordCount: miningInput.requestedKeywordCount,
    languagePreference: miningInput.languagePreference ?? "en",
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
  storage.updateTaskStatus({ taskId, status: "keyword_generating" });
  const existingMinedKeywords = storage.getAllMinedKeywordsForDedup();

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

  storage.saveAiKeywordRun({
    runId: keywordResult.runId,
    taskId,
    promptText: keywordResult.promptText,
    rawResponse: keywordResult.rawResponse,
    parsedKeywords: keywordResult.parsedKeywords,
    dedupedKeywords: keywordResult.dedupedKeywords,
    status: keywordResult.status,
    failureReason: keywordResult.failureReason,
  });

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

const recordSearchFailure = (
  runtime: AmazonFlowRuntime,
  keywordId: string,
  blockerKind: string,
  reason: string,
): void => {
  const { storage, logger, taskId, manualRequiredReasons } = runtime;
  storage.updateKeywordStatus({ keywordId, status: "failed" });
  storage.persistException({
    exceptionId: randomUUID(),
    taskId,
    scope: "search",
    scopeId: keywordId,
    exceptionKind: blockerKind,
    message: reason,
  });
  logger.logFailure({ taskId, scope: "search", scopeId: keywordId, reason });
  if (blockerKind === "login_required" || blockerKind === "captcha") {
    manualRequiredReasons.push(`search_blocked:${blockerKind}`);
  }
};

const resolveItemAsin = (productUrl: string, asinIfAvailable: string | null): string =>
  asinIfAvailable ?? productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ?? productUrl;

const extractAndPersistReviews = async (
  runtime: AmazonFlowRuntime,
  detailId: string,
  asin: string,
): Promise<void> => {
  const { ctx, storage, logger, taskId, miningInput, manualRequiredReasons } = runtime;
  const reviewsUrl = `https://www.${miningInput.amazonMarketplace}/product-reviews/${asin}`;
  storage.updateProductStatus({ detailId, status: "review_extracting" });

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

  if (paginationResult.restriction === "manual_required") {
    manualRequiredReasons.push(`reviews_restricted:detailId=${detailId}`);
    storage.updateProductStatus({ detailId, status: "manual_required" });
    logger.logManualRequired({ taskId, scope: "reviews", scopeId: detailId, reason: "review_page_blocked" });
    return;
  }

  storage.updateProductStatus({ detailId, status: "completed" });
};

const processSearchItem = async (runtime: AmazonFlowRuntime, item: { itemId: string; productUrl: string | null; asinIfAvailable: string | null }): Promise<void> => {
  if (!item.productUrl) return;
  const asin = resolveItemAsin(item.productUrl, item.asinIfAvailable);
  const productDetail = await extractAndPersistProductDetail(runtime, item.itemId, item.productUrl, asin);
  if (!productDetail) return;
  if (!productDetail.asin) {
    runtime.storage.updateProductStatus({ detailId: productDetail.detailId, status: "detail_completed" });
    return;
  }
  await extractAndPersistReviews(runtime, productDetail.detailId, productDetail.asin);
};

const processKeywordRecord = async (
  runtime: AmazonFlowRuntime,
  keywordRecord: ReturnType<typeof buildKeywordRecords>[number],
): Promise<void> => {
  const { ctx, storage, logger, taskId, miningInput } = runtime;
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
    return;
  }

  logger.logSearchExtracted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });
  storage.persistSearchResults(searchResult.items);
  logger.logSearchPersisted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });
  storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "search_completed" });

  for (const item of searchResult.items) {
    await processSearchItem(runtime, item);
  }

  storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "completed" });
};

const extractAndPersistProductDetail = async (
  runtime: AmazonFlowRuntime,
  itemId: string,
  productUrl: string,
  asin: string,
) => {
  const { ctx, storage, logger, taskId } = runtime;
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
  await runtime.ctx.browser.open({
    url: "about:blank",
    title: `Amazon mining workspace: ${runtime.taskId}`,
    reusePolicy: "open-new-tab",
  });
};

const runMiningPhase = async (
  runtime: AmazonFlowRuntime,
  keywordRecords: ReturnType<typeof buildKeywordRecords>,
): Promise<void> => {
  runtime.storage.updateTaskStatus({ taskId: runtime.taskId, status: "mining" });
  await openDedicatedMiningTab(runtime);
  for (const keywordRecord of keywordRecords) {
    await processKeywordRecord(runtime, keywordRecord);
  }
};

const buildPackagingArtifacts = async (runtime: AmazonFlowRuntime): Promise<PackagingArtifacts> => {
  const { storage, logger, taskId, miningInput, dataDir, manualRequiredReasons } = runtime;
  storage.updateTaskStatus({ taskId, status: "packaging" });

  const packageResult = await buildAmazonProductMiningPackage(buildPackageInput(runtime));
  logger.logPackageBuilt({
    taskId,
    packageJsonPath: packageResult.packageJsonPath,
    evidenceIndexPath: packageResult.evidenceIndexPath,
    exceptionSummaryPath: packageResult.exceptionSummaryPath,
  });

  const reportResult = buildAmazonProductMiningReport({
    taskId,
    dataDir,
    packageJsonPath: packageResult.packageJsonPath,
    productCount: packageResult.productCount,
    reviewCount: packageResult.reviewCount,
    keywordCount: packageResult.keywordCount,
    productDirection: miningInput.productDirection,
    amazonMarketplace: miningInput.amazonMarketplace,
    targetMarket: miningInput.targetMarket,
  });

  if (!reportResult.ok) {
    manualRequiredReasons.push(`report_build_failed:${reportResult.reason}`);
    return { packageResult, pdfPath: null };
  }

  logger.logPdfBuilt({ taskId, pdfReportPath: reportResult.pdfReportPath });
  return { packageResult, pdfPath: reportResult.pdfReportPath };
};

const didAllKeywordsFail = (runtime: AmazonFlowRuntime): boolean => {
  const keywords = runtime.storage.getKeywordsForTask(runtime.taskId);
  return keywords.length > 0
    && keywords.every((keyword) => keyword.status === "failed" || keyword.status === "manual_required");
};

const resolveFinalTaskState = (input: {
  allKeywordsFailed: boolean;
  handoffStatus: string;
  manualRequiredReasons: readonly string[];
}): FinalTaskResolution => {
  const finalTaskStatus = input.allKeywordsFailed
    ? "failed"
    : input.manualRequiredReasons.length > 0 ? "manual_required" : "package_completed";
  const finalHandoffStatus = finalTaskStatus === "package_completed" && input.handoffStatus !== "manual_required"
    ? "ready"
    : "failed";
  const finalFailureReason = finalTaskStatus === "failed" || finalTaskStatus === "manual_required"
    ? input.manualRequiredReasons.join("; ")
    : null;

  return {
    finalTaskStatus,
    finalHandoffStatus,
    finalFailureReason,
  };
};

const persistFinalPackagingState = async (
  runtime: AmazonFlowRuntime,
  artifacts: PackagingArtifacts,
  resolution: FinalTaskResolution,
): Promise<void> => {
  const { storage, logger, taskId, manualRequiredReasons } = runtime;
  storage.updateTaskStatus({
    taskId,
    status: resolution.finalTaskStatus,
    failureReason: resolution.finalFailureReason,
    packageJsonPath: artifacts.packageResult.packageJsonPath,
    pdfReportPath: artifacts.pdfPath,
    evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
    exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
    handoffStatus: resolution.finalHandoffStatus,
  });
  await buildAmazonProductMiningPackage(buildPackageInput(runtime));

  if (resolution.finalHandoffStatus === "ready") {
    logger.logHandoffReady({ taskId });
  } else {
    logger.logManualRequired({ taskId, scope: "handoff", reason: manualRequiredReasons.join("; ") });
  }

  logger.logMissionComplete({ taskId });
};

const finalizePackaging = async (runtime: AmazonFlowRuntime): Promise<AmazonFlowResult> => {
  const { storage, taskId, dataDir, manualRequiredReasons } = runtime;
  let artifacts = await buildPackagingArtifacts(runtime);
  const allKeywordsFailed = didAllKeywordsFail(runtime);
  if (allKeywordsFailed) {
    manualRequiredReasons.push("all_keywords_failed");
  }

  let handoff = writeAmazonHandoffRecord({
    dataDir,
    taskId,
    packageJsonPath: artifacts.packageResult.packageJsonPath,
    reportPath: artifacts.pdfPath ?? "",
    evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
    exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
    productCount: artifacts.packageResult.productCount,
    reviewCount: artifacts.packageResult.reviewCount,
    keywordCount: artifacts.packageResult.keywordCount,
    amazonMarketplace: runtime.miningInput.amazonMarketplace,
    targetMarket: runtime.miningInput.targetMarket,
    productDirection: runtime.miningInput.productDirection,
    requestedKeywordCount: runtime.miningInput.requestedKeywordCount,
    languagePreference: runtime.miningInput.languagePreference ?? "en",
    packageIntegrityStatus: artifacts.packageResult.integrityStatus,
    manualRequiredReasons,
  });

  artifacts = {
    ...artifacts,
    packageResult: await buildAmazonProductMiningPackage(buildPackageInput(runtime)),
  };
  if (artifacts.packageResult.integrityStatus === "failed" && !manualRequiredReasons.includes("package_integrity_failed")) {
    manualRequiredReasons.push("package_integrity_failed");
  }

  const shouldBeReady = manualRequiredReasons.length === 0 && artifacts.packageResult.integrityStatus === "pass";
  if ((handoff.handoffStatus === "ready") !== shouldBeReady) {
    handoff = writeAmazonHandoffRecord({
      dataDir,
      taskId,
      packageJsonPath: artifacts.packageResult.packageJsonPath,
      reportPath: artifacts.pdfPath ?? "",
      evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
      exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
      productCount: artifacts.packageResult.productCount,
      reviewCount: artifacts.packageResult.reviewCount,
      keywordCount: artifacts.packageResult.keywordCount,
      amazonMarketplace: runtime.miningInput.amazonMarketplace,
      targetMarket: runtime.miningInput.targetMarket,
      productDirection: runtime.miningInput.productDirection,
      requestedKeywordCount: runtime.miningInput.requestedKeywordCount,
      languagePreference: runtime.miningInput.languagePreference ?? "en",
      packageIntegrityStatus: artifacts.packageResult.integrityStatus,
      manualRequiredReasons,
    });
    artifacts = {
      ...artifacts,
      packageResult: await buildAmazonProductMiningPackage(buildPackageInput(runtime)),
    };
  }

  const resolution = resolveFinalTaskState({
    allKeywordsFailed,
    handoffStatus: handoff.handoffStatus,
    manualRequiredReasons,
  });
  await persistFinalPackagingState(runtime, artifacts, resolution);
  return taskRecordToResult(storage.getTask(taskId)!);
};

const buildFailedTaskRecord = (runtime: AmazonFlowRuntime, message: string) => ({
  taskId: runtime.taskId,
  amazonMarketplace: runtime.miningInput.amazonMarketplace as "amazon.com",
  targetMarket: runtime.miningInput.targetMarket,
  productDirection: runtime.miningInput.productDirection,
  requestedKeywordCount: runtime.miningInput.requestedKeywordCount,
  languagePreference: runtime.miningInput.languagePreference ?? "en",
  status: "failed" as const,
  failureReason: message,
  packageJsonPath: null,
  pdfReportPath: null,
  evidenceIndexPath: null,
  exceptionSummaryPath: null,
  handoffStatus: "not_started" as const,
  createdAt: new Date().toISOString(),
  updatedAt: null,
});

const buildFailureResult = (runtime: AmazonFlowRuntime, error: unknown): AmazonFlowResult => {
  const message = error instanceof Error ? error.message : String(error);
  runtime.storage.updateTaskStatus({ taskId: runtime.taskId, status: "failed", failureReason: message });
  runtime.logger.logFailure({ taskId: runtime.taskId, scope: "flow", reason: message });
  const failedTask = runtime.storage.getTask(runtime.taskId);
  return taskRecordToResult(failedTask ?? buildFailedTaskRecord(runtime, message));
};

export const runAmazonProductMiningFlow = async (ctx: AmazonFlowContext): Promise<AmazonFlowResult> => {
  const runtime = createAmazonFlowRuntime(ctx);

  try {
    createTaskRecord(runtime);
    const keywordPhase = await runKeywordPhase(runtime);
    if (keywordPhase.kind === "stop") {
      return keywordPhase.result;
    }
    await runMiningPhase(runtime, keywordPhase.keywordRecords);
    return await finalizePackaging(runtime);
  } catch (error) {
    return buildFailureResult(runtime, error);
  } finally {
    runtime.storage.close();
  }
};
