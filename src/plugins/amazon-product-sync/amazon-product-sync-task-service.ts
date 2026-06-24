import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createId } from "../../lib/local-runtime/ids.js";
import { RuntimeFailureClass, RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { buildMissingItem, runAmazonProductSyncFlow, type AmazonProductSyncFlowProgress } from "./amazon-product-sync.flow.js";
import {
  AmazonProductSyncInputSchema,
  type AmazonProductSyncInput,
  type AmazonProductSyncTaskRecord,
} from "./amazon-product-sync.schema.js";
import {
  persistAmazonProductSyncTask,
  readAmazonProductSyncTask,
  readLatestAmazonProductSyncTask,
} from "./amazon-product-sync.storage.js";

const flowTimeoutReasonPrefix = "amazon_product_sync_flow_timeout_after_";
const runningProgressStaleMs = 3_000;
const runningProgressStaleReason = `amazon_product_sync_running_progress_stale_after_${runningProgressStaleMs}ms`;
const accountSecurityReasons = new Set(["login_required", "captcha_or_2fa_required", "review_required"]);

export type AmazonProductSyncRuntime = {
  readonly dataDir: string;
  readonly browser: BrowserController;
  readonly runtimeLogger: RuntimeLogger;
  readonly flowTimeoutMs?: number;
};

const initialTask = (mission: AmazonProductSyncInput, taskId = createId("amazon_product_sync")): AmazonProductSyncTaskRecord => {
  const now = new Date().toISOString();
  const queuedOk = false;
  return {
    taskId,
    site: mission.site,
    requestId: mission.requestId,
    marketplace: mission.marketplace,
    ok: queuedOk,
    status: "queued",
    reason: null,
    reachedStep: "queued",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
};

const logStartReceived = (runtime: AmazonProductSyncRuntime, mission: AmazonProductSyncInput): void => {
  runtime.runtimeLogger.emit({
    traceId: mission.requestId,
    level: "info",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.MISSION_STARTED,
    owner: "local-runtime",
    missionId: mission.requestId,
    runId: mission.requestId,
    status: "started",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.start_received",
      site: mission.site,
      marketplace: mission.marketplace,
      itemCount: String(mission.items.length),
      requestedFields: [...new Set(mission.items.flatMap((item) => item.requiredFields))].join(","),
    },
  });
};

const logQueued = (
  runtime: AmazonProductSyncRuntime,
  mission: AmazonProductSyncInput,
  queued: AmazonProductSyncTaskRecord,
): void => {
  runtime.runtimeLogger.emit({
    traceId: queued.taskId,
    level: "info",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    owner: "local-runtime",
    missionId: queued.taskId,
    runId: mission.requestId,
    stepId: queued.taskId,
    status: "started",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.queued",
      site: mission.site,
      itemCount: String(mission.items.length),
    },
  });
};

const logFlowFinished = (runtime: AmazonProductSyncRuntime, result: AmazonProductSyncTaskRecord): void => {
  if (result.ok) {
    runtime.runtimeLogger.emit({
      traceId: result.taskId,
      level: "info",
      modeVisibility: ["FLOW"],
      eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED,
      owner: "local-runtime",
      missionId: result.taskId,
      runId: result.requestId,
      stepId: result.taskId,
      status: "success",
      refs: {
        module: "amazon-product-sync",
        source: "grasseye-agent",
        event: "amazon_product_sync.flow_finished",
        site: result.site,
        taskStatus: result.status,
        itemCount: String(result.items.length),
      },
    });
    return;
  }

  runtime.runtimeLogger.emit({
    traceId: result.taskId,
    level: "error",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
    owner: "local-runtime",
    missionId: result.taskId,
    runId: result.requestId,
    stepId: result.taskId,
    status: "review_required",
    reason: result.reason ?? "amazon_product_sync_review_required",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.flow_finished",
      site: result.site,
      taskStatus: result.status,
      itemCount: String(result.items.length),
    },
    payload: {
      failureClass: resolveFailureClass(result.reason, result.items),
      stageName: "amazon_product_sync_flow",
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
    },
  });
};

const diagnosticValue = (value: string | null | undefined): string => value && value.length > 0 ? value : "unknown";

const itemAuthGate = (item: AmazonProductSyncTaskRecord["items"][number]): string =>
  item.diagnostic?.authGate
  ?? (item.reason && accountSecurityReasons.has(item.reason) ? item.reason : "none");

const resolveFailureClass = (
  reason: string | null | undefined,
  items: readonly AmazonProductSyncTaskRecord["items"][number][] = [],
): RuntimeFailureClass => {
  if (reason && accountSecurityReasons.has(reason)) return RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER;
  if (items.some((item) => accountSecurityReasons.has(itemAuthGate(item)) || (item.reason && accountSecurityReasons.has(item.reason)))) {
    return RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER;
  }
  return RuntimeFailureClass.DOM_PROBE_FAILURE;
};

const logProgress = (
  runtime: AmazonProductSyncRuntime,
  mission: AmazonProductSyncInput,
  task: AmazonProductSyncTaskRecord,
  progress: AmazonProductSyncFlowProgress,
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: "info",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: mission.requestId,
    stepId: progress.reachedStep,
    status: "started",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.progress",
      site: mission.site,
      marketplace: mission.marketplace,
      reachedStep: progress.reachedStep,
      previousStep: task.reachedStep,
      itemCount: String(progress.items?.length ?? task.items.length),
      reason: progress.reason ?? "progress_continues",
      authGate: progress.authGate ?? "none",
      detectedState: progress.detectedState ?? "unknown",
      diagnosticStage: progress.diagnosticStage ?? progress.reachedStep,
      pageTitle: diagnosticValue(progress.pageTitle),
      pageUrlPath: diagnosticValue(progress.pageUrlPath),
    },
  });
};

const logMatchedItemSummary = (
  runtime: AmazonProductSyncRuntime,
  result: AmazonProductSyncTaskRecord,
  item: AmazonProductSyncTaskRecord["items"][number],
): void => {
  runtime.runtimeLogger.emit({
    traceId: result.taskId,
    level: "info",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED,
    owner: "local-runtime",
    missionId: result.taskId,
    runId: result.requestId,
    stepId: `amazon_product_sync_item:${item.sellerSku}`,
    status: "success",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.item_summary",
      site: result.site,
      sellerSku: item.sellerSku,
      itemStatus: item.status,
      requestedFields: item.requestedFields.join(","),
      missingRequestedFields: item.missingRequestedFields.join(",") || "none",
      availableFbaUnits: item.availableFbaUnits === null ? "null" : String(item.availableFbaUnits),
      actualInventoryUnits: item.actualInventoryUnits === null ? "null" : String(item.actualInventoryUnits),
      rowEvidenceRef: item.rowEvidenceRef ?? "none",
      mainImageEvidenceRef: item.sellerCentralMainImageEvidenceRef ?? "none",
      mainImageUploadStatus: item.mainImageUpload?.status ?? "none",
      mainImageUploadMediaId: item.mainImageUpload?.mediaId ?? "none",
    },
  });
};

const logReviewItemSummary = (
  runtime: AmazonProductSyncRuntime,
  result: AmazonProductSyncTaskRecord,
  item: AmazonProductSyncTaskRecord["items"][number],
): void => {
  const diagnostic = item.diagnostic;
  runtime.runtimeLogger.emit({
    traceId: result.taskId,
    level: "warn",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
    owner: "local-runtime",
    missionId: result.taskId,
    runId: result.requestId,
    stepId: `amazon_product_sync_item:${item.sellerSku}`,
    status: "review_required",
    reason: item.reason ?? "item_not_matched",
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.item_summary",
      site: result.site,
      sellerSku: item.sellerSku,
      itemStatus: item.status,
      requestedFields: item.requestedFields.join(","),
      missingRequestedFields: item.missingRequestedFields.join(",") || "none",
      availableFbaUnits: item.availableFbaUnits === null ? "null" : String(item.availableFbaUnits),
      actualInventoryUnits: item.actualInventoryUnits === null ? "null" : String(item.actualInventoryUnits),
      rowEvidenceRef: item.rowEvidenceRef ?? "none",
      mainImageEvidenceRef: item.sellerCentralMainImageEvidenceRef ?? "none",
      mainImageUploadStatus: item.mainImageUpload?.status ?? "none",
      mainImageUploadReason: item.mainImageUpload?.reason ?? "none",
      authGate: itemAuthGate(item),
      detectedState: diagnosticValue(diagnostic?.detectedState),
      diagnosticStage: diagnosticValue(diagnostic?.diagnosticStage),
      pageTitle: diagnosticValue(diagnostic?.pageTitle),
      pageUrlPath: diagnosticValue(diagnostic?.pageUrlPath),
    },
    payload: {
      failureClass: resolveFailureClass(item.reason, [item]),
      stageName: "amazon_product_sync_item",
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
    },
  });
};

const logItemSummary = (runtime: AmazonProductSyncRuntime, result: AmazonProductSyncTaskRecord): void => {
  for (const item of result.items) {
    if (item.status === "matched") {
      logMatchedItemSummary(runtime, result, item);
    } else {
      logReviewItemSummary(runtime, result, item);
    }
  }
};

const logFlowFailed = (
  runtime: AmazonProductSyncRuntime,
  mission: AmazonProductSyncInput,
  running: AmazonProductSyncTaskRecord,
  error: unknown,
): void => {
  runtime.runtimeLogger.emit({
    traceId: running.taskId,
    level: "error",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
    owner: "local-runtime",
    missionId: running.taskId,
    runId: mission.requestId,
    stepId: running.taskId,
    status: "failed",
    reason: error instanceof Error ? error.message : String(error),
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.flow_failed",
      site: mission.site,
    },
    payload: {
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      stageName: "amazon_product_sync_flow",
      retryable: false,
      terminal: true,
      recoveryPolicy: "terminal",
    },
  });
};

const logStaleRunningTask = (
  runtimeLogger: RuntimeLogger | undefined,
  task: AmazonProductSyncTaskRecord,
): void => {
  runtimeLogger?.emit({
    traceId: task.taskId,
    level: "error",
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: "flow_progress_stale",
    status: "failed",
    reason: runningProgressStaleReason,
    refs: {
      module: "amazon-product-sync",
      source: "grasseye-agent",
      event: "amazon_product_sync.stale_running_task_failed",
      site: task.site,
      taskStatus: task.status,
      reachedStep: task.reachedStep,
      updatedAt: task.updatedAt,
    },
    payload: {
      failureClass: RuntimeFailureClass.TRANSIENT_RETRYABLE,
      stageName: "amazon_product_sync_status_read",
      retryable: true,
      terminal: true,
      recoveryPolicy: "terminal",
    },
  });
};

const resolveFlowTimeoutMs = (runtime: AmazonProductSyncRuntime, mission: AmazonProductSyncInput): number =>
  runtime.flowTimeoutMs ?? Math.min(900_000, 120_000 + mission.items.length * 60_000);

const isRunningTaskStale = (task: AmazonProductSyncTaskRecord, nowMs = Date.now()): boolean => {
  if (task.status !== "queued" && task.status !== "running") return false;
  const updatedAtMs = Date.parse(task.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return true;
  return nowMs - updatedAtMs > runningProgressStaleMs;
};

const failStaleRunningTask = (
  dataDir: string,
  task: AmazonProductSyncTaskRecord,
  runtimeLogger?: RuntimeLogger,
): Promise<AmazonProductSyncTaskRecord> => {
  logStaleRunningTask(runtimeLogger, task);
  return persistAmazonProductSyncTask(dataDir, {
    ...task,
    ok: false,
    status: "failed",
    reason: runningProgressStaleReason,
    reachedStep: "flow_progress_stale",
    updatedAt: new Date().toISOString(),
  });
};

const runFlowWithTimeout = (
  runtime: AmazonProductSyncRuntime,
  mission: AmazonProductSyncInput,
  queued: AmazonProductSyncTaskRecord,
  onProgress: (progress: AmazonProductSyncFlowProgress) => Promise<void>,
): Promise<AmazonProductSyncTaskRecord> => {
  const timeoutMs = resolveFlowTimeoutMs(runtime, mission);
  let acceptingProgress = true;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      acceptingProgress = false;
      reject(new Error(`${flowTimeoutReasonPrefix}${timeoutMs}ms`));
    }, timeoutMs);
    void runAmazonProductSyncFlow({
      browser: runtime.browser,
      mission,
      taskId: queued.taskId,
      createdAt: queued.createdAt,
      onProgress: (progress) => acceptingProgress ? onProgress(progress) : Promise.resolve(),
    }).then((result) => {
      acceptingProgress = false;
      clearTimeout(timeout);
      resolve(result);
    }).catch((error) => {
      acceptingProgress = false;
      clearTimeout(timeout);
      reject(error);
    });
  });
};

export const startAmazonProductSyncTask = async (
  rawInput: unknown,
  runtime: AmazonProductSyncRuntime,
): Promise<AmazonProductSyncTaskRecord> => {
  const mission = AmazonProductSyncInputSchema.parse(rawInput);
  logStartReceived(runtime, mission);
  const queued = await persistAmazonProductSyncTask(runtime.dataDir, initialTask(mission));
  logQueued(runtime, mission, queued);
  const running = await persistAmazonProductSyncTask(runtime.dataDir, {
    ...queued,
    status: "running",
    reachedStep: "flow_started",
    updatedAt: new Date().toISOString(),
  });
  let latestProgress = running;
  const persistProgress = async (progress: AmazonProductSyncFlowProgress): Promise<void> => {
    logProgress(runtime, mission, latestProgress, progress);
    latestProgress = await persistAmazonProductSyncTask(runtime.dataDir, {
      ...latestProgress,
      ok: false,
      status: "running",
      reason: progress.reason ?? null,
      reachedStep: progress.reachedStep,
      items: [...(progress.items ?? latestProgress.items)],
      updatedAt: new Date().toISOString(),
    });
  };
  void runFlowWithTimeout(runtime, mission, queued, persistProgress)
    .then((result) => {
      logItemSummary(runtime, result);
      logFlowFinished(runtime, result);
      return persistAmazonProductSyncTask(runtime.dataDir, result);
    })
    .catch((error) => {
      logFlowFailed(runtime, mission, running, error);
      const reason = error instanceof Error ? error.message : String(error);
      const items = reason.startsWith(flowTimeoutReasonPrefix) && latestProgress.items.length === 0
        ? mission.items.map((item) => buildMissingItem(item, new Date().toISOString(), reason, "blocked"))
        : latestProgress.items;
      return persistAmazonProductSyncTask(runtime.dataDir, {
        ...latestProgress,
        ok: false,
        status: "failed",
        reason,
        reachedStep: latestProgress.reachedStep,
        items,
        updatedAt: new Date().toISOString(),
      });
    });
  return running;
};

export const getAmazonProductSyncTaskStatus = async (
  input: { readonly dataDir: string; readonly taskId: string; readonly runtimeLogger?: RuntimeLogger },
): Promise<AmazonProductSyncTaskRecord | null> => {
  const task = await readAmazonProductSyncTask(input.dataDir, input.taskId);
  if (!task) return null;
  if (isRunningTaskStale(task)) return failStaleRunningTask(input.dataDir, task, input.runtimeLogger);
  return task;
};

export const getLatestAmazonProductSyncTask = (
  input: { readonly dataDir: string; readonly runtimeLogger?: RuntimeLogger },
): Promise<AmazonProductSyncTaskRecord | null> =>
  readLatestAmazonProductSyncTask(input.dataDir).then((task) => {
    if (!task) return null;
    if (isRunningTaskStale(task)) return failStaleRunningTask(input.dataDir, task, input.runtimeLogger);
    return task;
  });
