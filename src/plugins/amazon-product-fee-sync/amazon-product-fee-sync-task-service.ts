import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createId } from "../../lib/local-runtime/ids.js";
import { RuntimeFailureClass, RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonProductFeeSyncFlow, type AmazonProductFeeSyncFlowProgress } from "./amazon-product-fee-sync.flow.js";
import {
  AmazonProductFeeSyncInputSchema,
  type AmazonProductFeeSyncInput,
  type AmazonProductFeeSyncTaskRecord,
} from "./amazon-product-fee-sync.schema.js";
import {
  persistAmazonProductFeeSyncTask,
  readAmazonProductFeeSyncTask,
  readLatestAmazonProductFeeSyncTask,
} from "./amazon-product-fee-sync.storage.js";

const flowTimeoutReasonPrefix = "amazon_product_fee_sync_flow_timeout_after_";
const runningProgressStaleMs = 3_000;
const runningProgressStaleReason = `amazon_product_fee_sync_running_progress_stale_after_${runningProgressStaleMs}ms`;
const accountSecurityReasons = new Set(["login_required", "captcha_or_2fa_required", "review_required"]);

export type AmazonProductFeeSyncRuntime = {
  readonly dataDir: string;
  readonly browser: BrowserController;
  readonly runtimeLogger: RuntimeLogger;
  readonly flowTimeoutMs?: number;
};

const initialTask = (
  mission: AmazonProductFeeSyncInput,
  taskId = createId("amazon_product_fee_sync"),
): AmazonProductFeeSyncTaskRecord => {
  const now = new Date().toISOString();
  return {
    taskId,
    site: mission.site,
    requestId: mission.requestId,
    marketplace: mission.marketplace,
    ok: false,
    status: "queued",
    reason: null,
    reachedStep: "queued",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
};

const diagnosticValue = (value: string | null | undefined): string =>
  value && value.length > 0 ? value : "unknown";

const itemAuthGate = (item: AmazonProductFeeSyncTaskRecord["items"][number]): string =>
  item.diagnostic?.authGate
  ?? (item.reason && accountSecurityReasons.has(item.reason) ? item.reason : "none");

const resolveFailureClass = (
  reason: string | null | undefined,
  items: readonly AmazonProductFeeSyncTaskRecord["items"][number][] = [],
): RuntimeFailureClass => {
  if (reason && accountSecurityReasons.has(reason)) return RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER;
  if (items.some((item) => accountSecurityReasons.has(itemAuthGate(item)) || (item.reason && accountSecurityReasons.has(item.reason)))) {
    return RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER;
  }
  return RuntimeFailureClass.DOM_PROBE_FAILURE;
};

const emitRuntimeEvent = (
  runtime: AmazonProductFeeSyncRuntime,
  task: Pick<AmazonProductFeeSyncTaskRecord, "taskId" | "requestId" | "site">,
  input: {
    readonly eventType: RuntimeLogEventType;
    readonly event: string;
    readonly level: "info" | "warn" | "error";
    readonly status: "started" | "success" | "review_required" | "failed";
    readonly stepId: string;
    readonly reason?: string | null;
    readonly refs?: Record<string, string>;
    readonly failureClass?: RuntimeFailureClass;
  },
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: input.level,
    modeVisibility: ["FLOW"],
    eventType: input.eventType,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: input.stepId,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    refs: {
      module: "amazon-product-fee-sync",
      source: "grasseye-agent",
      event: input.event,
      site: task.site,
      ...input.refs,
    },
    ...(input.failureClass
      ? {
          payload: {
            failureClass: input.failureClass,
            stageName: input.stepId,
            retryable: false,
            terminal: true,
            recoveryPolicy: input.status === "failed" ? "terminal" : "review_required",
          },
        }
      : {}),
  });
};

const logStartReceived = (runtime: AmazonProductFeeSyncRuntime, mission: AmazonProductFeeSyncInput): void => {
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
      module: "amazon-product-fee-sync",
      source: "grasseye-agent",
      event: "amazon_product_fee_sync.start_received",
      site: mission.site,
      marketplace: mission.marketplace,
      itemCount: String(mission.items.length),
      requestedFields: [...new Set(mission.items.flatMap((item) => item.requiredFields))].join(","),
    },
  });
};

const logProgress = (
  runtime: AmazonProductFeeSyncRuntime,
  mission: AmazonProductFeeSyncInput,
  task: AmazonProductFeeSyncTaskRecord,
  progress: AmazonProductFeeSyncFlowProgress,
): void => {
  emitRuntimeEvent(runtime, task, {
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    event: "amazon_product_fee_sync.progress",
    level: "info",
    status: "started",
    stepId: progress.reachedStep,
    ...(progress.reason === undefined ? {} : { reason: progress.reason }),
    refs: {
      marketplace: mission.marketplace,
      reachedStep: progress.reachedStep,
      previousStep: task.reachedStep,
      itemCount: String(progress.items?.length ?? task.items.length),
      authGate: progress.authGate ?? "none",
      detectedState: progress.detectedState ?? "unknown",
      diagnosticStage: progress.diagnosticStage ?? progress.reachedStep,
      pageTitle: diagnosticValue(progress.pageTitle),
      pageUrlPath: diagnosticValue(progress.pageUrlPath),
    },
  });
};

const logFlowFinished = (runtime: AmazonProductFeeSyncRuntime, result: AmazonProductFeeSyncTaskRecord): void => {
  emitRuntimeEvent(runtime, result, {
    eventType: result.ok ? RuntimeLogEventType.RUNTIME_STAGE_COMPLETED : RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
    event: "amazon_product_fee_sync.flow_finished",
    level: result.ok ? "info" : "error",
    status: result.ok ? "success" : "review_required",
    stepId: result.taskId,
    reason: result.ok ? null : result.reason ?? "amazon_product_fee_sync_review_required",
    refs: {
      taskStatus: result.status,
      itemCount: String(result.items.length),
    },
    ...(result.ok ? {} : { failureClass: resolveFailureClass(result.reason, result.items) }),
  });
};

const logItemSummary = (runtime: AmazonProductFeeSyncRuntime, result: AmazonProductFeeSyncTaskRecord): void => {
  for (const item of result.items) {
    emitRuntimeEvent(runtime, result, {
      eventType: item.status === "matched" ? RuntimeLogEventType.RUNTIME_STAGE_COMPLETED : RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
      event: "amazon_product_fee_sync.item_summary",
      level: item.status === "matched" ? "info" : "warn",
      status: item.status === "matched" ? "success" : "review_required",
      stepId: `amazon_product_fee_sync_item:${item.sellerSku}`,
      reason: item.reason,
      refs: {
        sellerSku: item.sellerSku,
        itemStatus: item.status,
        requestedFields: item.requestedFields.join(","),
        missingRequestedFields: item.missingRequestedFields.join(",") || "none",
        totalAmazonFeeAmount: item.totalAmazonFee.amount ?? "null",
        totalAmazonFeeCurrency: item.totalAmazonFee.currency ?? "null",
        fbaFulfillmentFeeAmount: item.fbaFulfillmentFee.amount ?? "null",
        fbaFulfillmentFeeCurrency: item.fbaFulfillmentFee.currency ?? "null",
        residualAmount: item.amazonNonFulfillmentFeeResidual.amount ?? "null",
        residualStatus: item.amazonNonFulfillmentFeeResidual.status,
        referralFeeStatus: item.referralFee.status,
        rowEvidenceRef: item.rowEvidenceRef ?? "none",
        feeEvidenceRef: item.feeEvidenceRef ?? "none",
        authGate: itemAuthGate(item),
        detectedState: diagnosticValue(item.diagnostic?.detectedState),
        diagnosticStage: diagnosticValue(item.diagnostic?.diagnosticStage),
        pageTitle: diagnosticValue(item.diagnostic?.pageTitle),
        pageUrlPath: diagnosticValue(item.diagnostic?.pageUrlPath),
      },
      ...(item.status === "matched" ? {} : { failureClass: resolveFailureClass(item.reason, [item]) }),
    });
  }
};

const logFlowFailed = (
  runtime: AmazonProductFeeSyncRuntime,
  mission: AmazonProductFeeSyncInput,
  running: AmazonProductFeeSyncTaskRecord,
  error: unknown,
): void => {
  emitRuntimeEvent(runtime, running, {
    eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
    event: "amazon_product_fee_sync.flow_failed",
    level: "error",
    status: "failed",
    stepId: "amazon_product_fee_sync_flow",
    reason: error instanceof Error ? error.message : String(error),
    refs: { marketplace: mission.marketplace },
    failureClass: RuntimeFailureClass.INTERNAL_BUG,
  });
};

const logStaleRunningTask = (
  runtimeLogger: RuntimeLogger | undefined,
  task: AmazonProductFeeSyncTaskRecord,
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
      module: "amazon-product-fee-sync",
      source: "grasseye-agent",
      event: "amazon_product_fee_sync.stale_running_task_failed",
      site: task.site,
      taskStatus: task.status,
      reachedStep: task.reachedStep,
      updatedAt: task.updatedAt,
    },
    payload: {
      failureClass: RuntimeFailureClass.TRANSIENT_RETRYABLE,
      stageName: "amazon_product_fee_sync_status_read",
      retryable: true,
      terminal: true,
      recoveryPolicy: "terminal",
    },
  });
};

const resolveFlowTimeoutMs = (runtime: AmazonProductFeeSyncRuntime): number =>
  runtime.flowTimeoutMs ?? 120_000;

const isRunningTaskStale = (task: AmazonProductFeeSyncTaskRecord, nowMs = Date.now()): boolean => {
  if (task.status !== "queued" && task.status !== "running") return false;
  const updatedAtMs = Date.parse(task.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return true;
  return nowMs - updatedAtMs > runningProgressStaleMs;
};

const failStaleRunningTask = (
  dataDir: string,
  task: AmazonProductFeeSyncTaskRecord,
  runtimeLogger?: RuntimeLogger,
): Promise<AmazonProductFeeSyncTaskRecord> => {
  logStaleRunningTask(runtimeLogger, task);
  return persistAmazonProductFeeSyncTask(dataDir, {
    ...task,
    ok: false,
    status: "failed",
    reason: runningProgressStaleReason,
    reachedStep: "flow_progress_stale",
    updatedAt: new Date().toISOString(),
  });
};

const runFlowWithTimeout = (
  runtime: AmazonProductFeeSyncRuntime,
  mission: AmazonProductFeeSyncInput,
  queued: AmazonProductFeeSyncTaskRecord,
  onProgress: (progress: AmazonProductFeeSyncFlowProgress) => Promise<void>,
): Promise<AmazonProductFeeSyncTaskRecord> => {
  const timeoutMs = resolveFlowTimeoutMs(runtime);
  let acceptingProgress = true;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      acceptingProgress = false;
      reject(new Error(`${flowTimeoutReasonPrefix}${timeoutMs}ms`));
    }, timeoutMs);
    void runAmazonProductFeeSyncFlow({
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

export const startAmazonProductFeeSyncTask = async (
  rawInput: unknown,
  runtime: AmazonProductFeeSyncRuntime,
): Promise<AmazonProductFeeSyncTaskRecord> => {
  const mission = AmazonProductFeeSyncInputSchema.parse(rawInput);
  logStartReceived(runtime, mission);
  const queued = await persistAmazonProductFeeSyncTask(runtime.dataDir, initialTask(mission));
  emitRuntimeEvent(runtime, queued, {
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    event: "amazon_product_fee_sync.queued",
    level: "info",
    status: "started",
    stepId: queued.taskId,
    refs: { itemCount: String(mission.items.length) },
  });
  const running = await persistAmazonProductFeeSyncTask(runtime.dataDir, {
    ...queued,
    status: "running",
    reachedStep: "flow_started",
    updatedAt: new Date().toISOString(),
  });
  let latestProgress = running;
  const persistProgress = async (progress: AmazonProductFeeSyncFlowProgress): Promise<void> => {
    logProgress(runtime, mission, latestProgress, progress);
    latestProgress = await persistAmazonProductFeeSyncTask(runtime.dataDir, {
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
      return persistAmazonProductFeeSyncTask(runtime.dataDir, result);
    })
    .catch((error) => {
      logFlowFailed(runtime, mission, running, error);
      return persistAmazonProductFeeSyncTask(runtime.dataDir, {
        ...latestProgress,
        ok: false,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        reachedStep: "flow_failed",
        updatedAt: new Date().toISOString(),
      });
    });
  return running;
};

export const getAmazonProductFeeSyncTaskStatus = async (
  input: { readonly dataDir: string; readonly taskId: string; readonly runtimeLogger?: RuntimeLogger },
): Promise<AmazonProductFeeSyncTaskRecord | null> => {
  const task = await readAmazonProductFeeSyncTask(input.dataDir, input.taskId);
  if (!task) return null;
  if (isRunningTaskStale(task)) return failStaleRunningTask(input.dataDir, task, input.runtimeLogger);
  return task;
};

export const getLatestAmazonProductFeeSyncTask = (
  input: { readonly dataDir: string; readonly runtimeLogger?: RuntimeLogger },
): Promise<AmazonProductFeeSyncTaskRecord | null> =>
  readLatestAmazonProductFeeSyncTask(input.dataDir).then((task) => {
    if (!task) return null;
    if (isRunningTaskStale(task)) return failStaleRunningTask(input.dataDir, task, input.runtimeLogger);
    return task;
  });
