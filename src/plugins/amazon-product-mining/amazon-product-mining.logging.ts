import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";

type AmazonStatus = "started" | "success" | "failed" | "review_required" | "skipped";

const emitAmazon = (input: {
  logger: RuntimeLogger;
  eventType: typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];
  taskId: string;
  roundId?: string;
  status: AmazonStatus;
  reason?: string;
  refs?: Record<string, string>;
}): void => input.logger.emit({
  traceId: input.taskId,
  ...(input.roundId ? { roundId: input.roundId } : {}),
  level: input.status === "failed" || input.status === "review_required" ? "error" : "info",
  modeVisibility: ["FLOW"],
  eventType: input.eventType,
  owner: "amazon-product-mining",
  missionId: input.taskId,
  runId: input.taskId,
  status: input.status,
  ...(input.reason ? { reason: input.reason } : {}),
  ...(input.refs ? { refs: input.refs } : {}),
});

export type AmazonMiningLogger = {
  logMissionStart(input: { taskId: string; marketplace: string; }): void;
  logKeywordAiSend(input: { taskId: string; runId: string; }): void;
  logKeywordAiCapture(input: { taskId: string; runId: string; rawLength: number; }): void;
  logKeywordParsed(input: { taskId: string; runId: string; parsedCount: number; dedupedCount: number; }): void;
  logKeywordQueuePersisted(input: { taskId: string; count: number; }): void;
  logSearchOpen(input: { taskId: string; keywordId: string; keyword: string; }): void;
  logSearchExtracted(input: { taskId: string; keywordId: string; count: number; }): void;
  logSearchPersisted(input: { taskId: string; keywordId: string; count: number; }): void;
  logDetailOpen(input: { taskId: string; detailId: string; productUrl: string; }): void;
  logDetailExtracted(input: { taskId: string; detailId: string; }): void;
  logDetailPersisted(input: { taskId: string; detailId: string; }): void;
  logReviewPageOpen(input: { taskId: string; detailId: string; pageIndex: number; }): void;
  logReviewPageExtracted(input: { taskId: string; detailId: string; pageIndex: number; count: number; }): void;
  logReviewPagePersisted(input: { taskId: string; detailId: string; pageIndex: number; count: number; }): void;
  logPackageBuilt(input: { taskId: string; packageJsonPath: string; evidenceIndexPath: string; exceptionSummaryPath: string; }): void;
  logPdfBuilt(input: { taskId: string; pdfReportPath: string; }): void;
  logHandoffReady(input: { taskId: string; }): void;
  logMissionComplete(input: { taskId: string; }): void;
  logFailure(input: { taskId: string; scope: string; scopeId?: string; reason: string; }): void;
  logManualRequired(input: { taskId: string; scope: string; scopeId?: string; reason: string; }): void;
};

export const createAmazonMiningLogger = (runtimeLogger: RuntimeLogger): AmazonMiningLogger => ({
  logMissionStart({ taskId, marketplace }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.MISSION_STARTED, taskId, status: "started", refs: { marketplace } });
  },
  logKeywordAiSend({ taskId, runId }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.AI_UPLOAD_STARTED, taskId, roundId: runId, status: "started" });
  },
  logKeywordAiCapture({ taskId, runId, rawLength }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.AI_UPLOAD_COMPLETED, taskId, roundId: runId, status: "success", refs: { rawLength: String(rawLength) } });
  },
  logKeywordParsed({ taskId, runId, parsedCount, dedupedCount }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: runId, status: "success", refs: { parsedCount: String(parsedCount), dedupedCount: String(dedupedCount) } });
  },
  logKeywordQueuePersisted({ taskId, count }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, status: "success", refs: { keywordQueueCount: String(count) } });
  },
  logSearchOpen({ taskId, keywordId, keyword }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED, taskId, roundId: keywordId, status: "started", refs: { keyword } });
  },
  logSearchExtracted({ taskId, keywordId, count }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: keywordId, status: "success", refs: { extractedCount: String(count) } });
  },
  logSearchPersisted({ taskId, keywordId, count }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: keywordId, status: "success", refs: { persistedCount: String(count) } });
  },
  logDetailOpen({ taskId, detailId, productUrl }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED, taskId, roundId: detailId, status: "started", refs: { productUrl } });
  },
  logDetailExtracted({ taskId, detailId }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: detailId, status: "success" });
  },
  logDetailPersisted({ taskId, detailId }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: detailId, status: "success", refs: { detailId } });
  },
  logReviewPageOpen({ taskId, detailId, pageIndex }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED, taskId, roundId: detailId, status: "started", refs: { pageIndex: String(pageIndex) } });
  },
  logReviewPageExtracted({ taskId, detailId, pageIndex, count }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: detailId, status: "success", refs: { pageIndex: String(pageIndex), count: String(count) } });
  },
  logReviewPagePersisted({ taskId, detailId, pageIndex, count }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, roundId: detailId, status: "success", refs: { pageIndex: String(pageIndex), persistedReviews: String(count) } });
  },
  logPackageBuilt({ taskId, packageJsonPath, evidenceIndexPath, exceptionSummaryPath }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, status: "success", refs: { packageJsonPath, evidenceIndexPath, exceptionSummaryPath } });
  },
  logPdfBuilt({ taskId, pdfReportPath }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, status: "success", refs: { pdfReportPath } });
  },
  logHandoffReady({ taskId }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED, taskId, status: "success" });
  },
  logMissionComplete({ taskId }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.MISSION_COMPLETED, taskId, status: "success" });
  },
  logFailure({ taskId, scope, scopeId, reason }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED, taskId, ...(scopeId !== undefined ? { roundId: scopeId } : {}), status: "failed", reason, refs: { scope } });
  },
  logManualRequired({ taskId, scope, scopeId, reason }) {
    emitAmazon({ logger: runtimeLogger, eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED, taskId, ...(scopeId !== undefined ? { roundId: scopeId } : {}), status: "review_required", reason, refs: { scope } });
  },
});
