import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonMiningInput, AmazonSearchResultItem } from "./amazon-product-mining.schema.js";
import { buildHandoffRecord } from "./amazon-product-mining.handoff.js";
import { createAmazonMiningLogger } from "./amazon-product-mining.logging.js";
import { buildAmazonProductMiningPackage } from "./amazon-product-mining.package.js";
import { buildAmazonProductMiningReport } from "./amazon-product-mining.pdf.js";
import { runProductDetailExtraction } from "./amazon-product-mining.product-detail.js";
import { taskRecordToResult } from "./amazon-product-mining.result.js";
import { runReviewPagination } from "./amazon-product-mining.reviews.js";
import { runAmazonSearch } from "./amazon-product-mining.search.js";
import { createAmazonMiningStorage } from "./amazon-product-mining.storage.js";
import { buildKeywordRecords, runKeywordGeneration } from "./amazon-product-mining.keyword.js";
import type { KeywordProviderKind } from "./amazon-product-mining.keyword.js";

export type AmazonFlowContext = {
  miningInput: AmazonMiningInput;
  taskId: string;
  dataDir: string;
  browser: BrowserController;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  providerKind?: KeywordProviderKind;
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

export const runAmazonProductMiningFlow = async (ctx: AmazonFlowContext): Promise<AmazonFlowResult> => {
  const storage = createAmazonMiningStorage(ctx.dataDir);
  const logger = createAmazonMiningLogger(ctx.runtimeLogger);
  const { taskId, miningInput, dataDir } = ctx;
  const manualRequiredReasons: string[] = [];

  try {
    // INTAKE — create task record
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

    // KEYWORD GENERATION
    storage.updateTaskStatus({ taskId, status: "keyword_generating" });
    const existingMinedKeywords = storage.getAllMinedKeywordsForDedup();

    logger.logKeywordAiSend({ taskId, runId: taskId });
    const keywordResult = await runKeywordGeneration({
      miningInput,
      taskId,
      existingMinedKeywords,
      aiInputGateway: ctx.aiInputGateway,
      ...(ctx.providerKind !== undefined ? { providerKind: ctx.providerKind } : {}),
    });
    logger.logKeywordAiCapture({ taskId, runId: keywordResult.runId, rawLength: keywordResult.rawResponse.length });

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
      return taskRecordToResult(storage.getTask(taskId)!);
    }

    logger.logKeywordParsed({ taskId, runId: keywordResult.runId, parsedCount: keywordResult.parsedKeywords.length, dedupedCount: keywordResult.dedupedKeywords.length });

    const keywordRecords = buildKeywordRecords({
      taskId,
      keywords: keywordResult.dedupedKeywords,
      aiRunId: keywordResult.runId,
    });
    storage.saveKeywords(keywordRecords);
    storage.updateTaskStatus({ taskId, status: "keyword_ready" });
    logger.logKeywordQueuePersisted({ taskId, count: keywordRecords.length });

    // MINING — for each keyword: search, persist results, then detail + reviews
    storage.updateTaskStatus({ taskId, status: "mining" });
    const allSearchItems: AmazonSearchResultItem[] = [];

    for (const keywordRecord of keywordRecords) {
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
        storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "failed" });
        storage.persistException({
          exceptionId: randomUUID(),
          taskId,
          scope: "search",
          scopeId: keywordRecord.keywordId,
          exceptionKind: searchResult.blockerKind,
          message: searchResult.reason,
        });
        logger.logFailure({ taskId, scope: "search", scopeId: keywordRecord.keywordId, reason: searchResult.reason });

        if (searchResult.blockerKind === "login_required" || searchResult.blockerKind === "captcha") {
          manualRequiredReasons.push(`search_blocked:${searchResult.blockerKind}`);
        }
        continue;
      }

      logger.logSearchExtracted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });

      // Persist search results BEFORE opening any product detail (law 005)
      storage.persistSearchResults(searchResult.items);
      logger.logSearchPersisted({ taskId, keywordId: keywordRecord.keywordId, count: searchResult.items.length });
      allSearchItems.push(...searchResult.items);

      storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "search_completed" });

      // For each search result: open detail, persist, then reviews
      for (const item of searchResult.items) {
        if (!item.productUrl) continue;
        const asin = item.asinIfAvailable ?? item.productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ?? item.productUrl;

        logger.logDetailOpen({ taskId, detailId: item.itemId, productUrl: item.productUrl });

        let productDetail;
        try {
          productDetail = await runProductDetailExtraction({
            browser: ctx.browser,
            productUrl: item.productUrl,
            asin,
            taskId,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          storage.persistException({
            exceptionId: randomUUID(),
            taskId,
            scope: "product_detail",
            scopeId: item.itemId,
            exceptionKind: "detail_extraction_failed",
            message: msg,
          });
          logger.logFailure({ taskId, scope: "product_detail", scopeId: item.itemId, reason: msg });
          continue;
        }

        logger.logDetailExtracted({ taskId, detailId: productDetail.detailId });

        // Persist product detail BEFORE opening reviews page (law 005)
        storage.persistProductDetail(productDetail, [item.itemId]);
        logger.logDetailPersisted({ taskId, detailId: productDetail.detailId });

        // Reviews pagination — persisted per page INSIDE loop (law 007)
        if (productDetail.asin) {
          const reviewsUrl = `https://www.${miningInput.amazonMarketplace}/product-reviews/${productDetail.asin}`;
          storage.updateProductStatus({ detailId: productDetail.detailId, status: "review_extracting" });

          const paginationResult = await runReviewPagination({
            browser: ctx.browser,
            reviewsUrl,
            detailId: productDetail.detailId,
            taskId,
            asin: productDetail.asin,
            ...(ctx.reviewMaxPages !== undefined ? { maxPages: ctx.reviewMaxPages } : {}),
            onPageExtracted: async (reviews, pageIndex) => {
              logger.logReviewPageOpen({ taskId, detailId: productDetail.detailId, pageIndex });
              logger.logReviewPageExtracted({ taskId, detailId: productDetail.detailId, pageIndex, count: reviews.length });
              // Persist per page (law 007)
              storage.persistReviews(reviews);
              logger.logReviewPagePersisted({ taskId, detailId: productDetail.detailId, pageIndex, count: reviews.length });
            },
          });

          if (paginationResult.restriction === "manual_required") {
            manualRequiredReasons.push(`reviews_restricted:detailId=${productDetail.detailId}`);
            storage.updateProductStatus({ detailId: productDetail.detailId, status: "manual_required" });
            logger.logManualRequired({ taskId, scope: "reviews", scopeId: productDetail.detailId, reason: "review_page_blocked" });
          } else {
            storage.updateProductStatus({ detailId: productDetail.detailId, status: "completed" });
          }
        } else {
          storage.updateProductStatus({ detailId: productDetail.detailId, status: "detail_completed" });
        }
      }

      storage.updateKeywordStatus({ keywordId: keywordRecord.keywordId, status: "completed" });
    }

    // PACKAGING
    storage.updateTaskStatus({ taskId, status: "packaging" });

    const packageResult = await buildAmazonProductMiningPackage({ taskId, dataDir, storage });
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

    let pdfPath: string | null = null;
    if (reportResult.ok) {
      pdfPath = reportResult.pdfReportPath;
      logger.logPdfBuilt({ taskId, pdfReportPath: pdfPath });
    } else {
      manualRequiredReasons.push(`report_build_failed:${reportResult.reason}`);
    }

    const handoff = buildHandoffRecord({
      taskId,
      packageJsonPath: packageResult.packageJsonPath,
      reportPath: pdfPath ?? "",
      evidenceIndexPath: packageResult.evidenceIndexPath,
      exceptionSummaryPath: packageResult.exceptionSummaryPath,
      productCount: packageResult.productCount,
      reviewCount: packageResult.reviewCount,
      keywordCount: packageResult.keywordCount,
      manualRequiredReasons,
    });

    const finalHandoffStatus = handoff.handoffStatus === "manual_required" ? "failed" as const : "ready" as const;
    const finalTaskStatus = manualRequiredReasons.length > 0 ? "manual_required" as const : "package_completed" as const;

    storage.updateTaskStatus({
      taskId,
      status: finalTaskStatus,
      packageJsonPath: packageResult.packageJsonPath,
      pdfReportPath: pdfPath,
      evidenceIndexPath: packageResult.evidenceIndexPath,
      exceptionSummaryPath: packageResult.exceptionSummaryPath,
      handoffStatus: finalHandoffStatus,
    });

    if (finalHandoffStatus === "ready") {
      logger.logHandoffReady({ taskId });
    } else {
      logger.logManualRequired({ taskId, scope: "handoff", reason: manualRequiredReasons.join("; ") });
    }

    logger.logMissionComplete({ taskId });

    const finalTask = storage.getTask(taskId);
    return taskRecordToResult(finalTask!);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    storage.updateTaskStatus({ taskId, status: "failed", failureReason: msg });
    logger.logFailure({ taskId, scope: "flow", reason: msg });
    const failedTask = storage.getTask(taskId);
    return taskRecordToResult(failedTask ?? {
      taskId,
      amazonMarketplace: miningInput.amazonMarketplace as "amazon.com",
      targetMarket: miningInput.targetMarket,
      productDirection: miningInput.productDirection,
      requestedKeywordCount: miningInput.requestedKeywordCount,
      languagePreference: miningInput.languagePreference ?? "en",
      status: "failed",
      failureReason: msg,
      packageJsonPath: null,
      pdfReportPath: null,
      evidenceIndexPath: null,
      exceptionSummaryPath: null,
      handoffStatus: "not_started",
      createdAt: new Date().toISOString(),
      updatedAt: null,
    });
  } finally {
    storage.close();
  }
};
