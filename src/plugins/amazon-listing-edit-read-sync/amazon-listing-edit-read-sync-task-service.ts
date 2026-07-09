import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createId } from "../../lib/local-runtime/ids.js";
import { RuntimeFailureClass, RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  runAmazonListingEditReadSyncFlow,
  type AmazonListingEditReadSyncFlowProgress,
} from "./amazon-listing-edit-read-sync.flow.js";
import {
  AmazonListingEditReadSyncInputSchema,
  type AmazonListingEditReadSyncInput,
  type AmazonListingEditReadSyncTargetResolution,
  type AmazonListingEditReadSyncTaskRecord,
} from "./amazon-listing-edit-read-sync.schema.js";
import {
  persistAmazonListingEditReadSyncTask,
  readAmazonListingEditReadSyncTask,
  readLatestAmazonListingEditReadSyncTask,
} from "./amazon-listing-edit-read-sync.storage.js";

export type AmazonListingEditReadSyncRuntime = {
  readonly dataDir: string;
  readonly browser: BrowserController;
  readonly runtimeLogger: RuntimeLogger;
  readonly flowTimeoutMs?: number;
};

const flowTimeoutReasonPrefix = "amazon_listing_edit_read_sync_flow_timeout_after_";

const initialTargetResolution = (
  mission: AmazonListingEditReadSyncInput,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? "not_required" : "not_found",
  reason: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? null : "target_resolution_not_started",
  candidateCount: 0,
  requested: mission.target,
  matchedParent: null,
  matchedChild: null,
  evidenceRefs: [],
});

const initialTask = (
  mission: AmazonListingEditReadSyncInput,
  taskId = createId("amazon_listing_edit_read_sync"),
): AmazonListingEditReadSyncTaskRecord => {
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
    targetResolution: initialTargetResolution(mission),
    inventoryItems: [],
    items: [],
    createdAt: now,
    updatedAt: now,
  };
};

const emitRuntimeEvent = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: Pick<AmazonListingEditReadSyncTaskRecord, "taskId" | "requestId" | "site">,
  input: {
    readonly event: string;
    readonly level: "info" | "warn" | "error";
    readonly status: "started" | "success" | "review_required" | "failed";
    readonly stepId: string;
    readonly reason?: string | null;
    readonly refs?: Record<string, string>;
    readonly failureClass?: RuntimeFailureClass;
  },
): void => {
  const refs = {
    module: "amazon-listing-edit-read-sync",
    source: "grasseye-agent",
    event: input.event,
    site: task.site,
    ...(input.refs ?? {}),
  };
  if (input.status === "started") {
    emitStartedRuntimeEvent(runtime, task, input, refs);
    return;
  }
  if (input.status === "success") {
    emitCompletedRuntimeEvent(runtime, task, input, refs);
    return;
  }
  if (input.status === "failed") {
    emitFailedRuntimeEvent(runtime, task, input, refs);
    return;
  }
  emitReviewRequiredRuntimeEvent(runtime, task, input, refs);
};

type ListingEditRuntimeEventInput = Parameters<typeof emitRuntimeEvent>[2];
type ListingEditRuntimeEventTask = Parameters<typeof emitRuntimeEvent>[1];

const emitStartedRuntimeEvent = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: ListingEditRuntimeEventTask,
  input: ListingEditRuntimeEventInput,
  refs: Record<string, string>,
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: input.level,
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: input.stepId,
    status: "started",
    refs,
  });
};

const emitCompletedRuntimeEvent = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: ListingEditRuntimeEventTask,
  input: ListingEditRuntimeEventInput,
  refs: Record<string, string>,
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: input.level,
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: input.stepId,
    status: "success",
    refs,
  });
};

const emitFailedRuntimeEvent = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: ListingEditRuntimeEventTask,
  input: ListingEditRuntimeEventInput,
  refs: Record<string, string>,
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: input.level,
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: input.stepId,
    status: "failed",
    reason: input.reason ?? "amazon_listing_edit_read_sync_failed",
    refs,
    payload: {
      failureClass: input.failureClass ?? RuntimeFailureClass.INTERNAL_BUG,
      stageName: input.stepId,
      retryable: false,
      terminal: true,
      recoveryPolicy: "terminal",
    },
  });
};

const emitReviewRequiredRuntimeEvent = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: ListingEditRuntimeEventTask,
  input: ListingEditRuntimeEventInput,
  refs: Record<string, string>,
): void => {
  runtime.runtimeLogger.emit({
    traceId: task.taskId,
    level: input.level,
    modeVisibility: ["FLOW"],
    eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
    owner: "local-runtime",
    missionId: task.taskId,
    runId: task.requestId,
    stepId: input.stepId,
    status: "review_required",
    reason: input.reason ?? "amazon_listing_edit_read_sync_review_required",
    refs,
    payload: {
      failureClass: input.failureClass ?? RuntimeFailureClass.DOM_PROBE_FAILURE,
      stageName: input.stepId,
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
    },
  });
};

const logStartReceived = (
  runtime: AmazonListingEditReadSyncRuntime,
  mission: AmazonListingEditReadSyncInput,
): void => {
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
      module: "amazon-listing-edit-read-sync",
      source: "grasseye-agent",
      event: "amazon_listing_edit_read_sync.start_received",
      site: mission.site,
      marketplace: mission.marketplace,
      scope: mission.scope,
      tabCount: String(mission.tabs.length),
    },
  });
};

const resolveFlowTimeoutMs = (runtime: AmazonListingEditReadSyncRuntime): number =>
  runtime.flowTimeoutMs ?? 300_000;

const runFlowWithTimeout = (
  runtime: AmazonListingEditReadSyncRuntime,
  mission: AmazonListingEditReadSyncInput,
  queued: AmazonListingEditReadSyncTaskRecord,
  onProgress: (progress: AmazonListingEditReadSyncFlowProgress) => Promise<void>,
): Promise<AmazonListingEditReadSyncTaskRecord> => {
  const timeoutMs = resolveFlowTimeoutMs(runtime);
  let acceptingProgress = true;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      acceptingProgress = false;
      reject(new Error(`${flowTimeoutReasonPrefix}${timeoutMs}ms`));
    }, timeoutMs);
    void runAmazonListingEditReadSyncFlow({
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

const logProgress = (
  runtime: AmazonListingEditReadSyncRuntime,
  task: AmazonListingEditReadSyncTaskRecord,
  progress: AmazonListingEditReadSyncFlowProgress,
): void => {
  emitRuntimeEvent(runtime, task, {
    event: "amazon_listing_edit_read_sync.progress",
    level: "info",
    status: "started",
    stepId: progress.reachedStep,
    ...(progress.reason === undefined ? {} : { reason: progress.reason }),
    refs: {
      reachedStep: progress.reachedStep,
      inventoryCount: String(progress.inventoryItems?.length ?? task.inventoryItems.length),
      itemCount: String(progress.items?.length ?? task.items.length),
      authGate: progress.diagnostic?.authGate ?? "none",
      diagnosticStage: progress.diagnostic?.diagnosticStage ?? progress.reachedStep,
    },
  });
};

export const startAmazonListingEditReadSyncTask = async (
  rawInput: unknown,
  runtime: AmazonListingEditReadSyncRuntime,
): Promise<AmazonListingEditReadSyncTaskRecord> => {
  const mission = AmazonListingEditReadSyncInputSchema.parse(rawInput);
  logStartReceived(runtime, mission);
  const queued = await persistAmazonListingEditReadSyncTask(runtime.dataDir, initialTask(mission));
  emitRuntimeEvent(runtime, queued, {
    event: "amazon_listing_edit_read_sync.queued",
    level: "info",
    status: "started",
    stepId: queued.taskId,
  });
  const running = await persistAmazonListingEditReadSyncTask(runtime.dataDir, {
    ...queued,
    status: "running",
    reachedStep: "flow_started",
    updatedAt: new Date().toISOString(),
  });
  let latestProgress = running;
  const persistProgress = async (progress: AmazonListingEditReadSyncFlowProgress): Promise<void> => {
    logProgress(runtime, latestProgress, progress);
    latestProgress = await persistAmazonListingEditReadSyncTask(runtime.dataDir, {
      ...latestProgress,
      status: "running",
      reason: progress.reason ?? null,
      reachedStep: progress.reachedStep,
      targetResolution: progress.targetResolution ?? latestProgress.targetResolution,
      inventoryItems: [...(progress.inventoryItems ?? latestProgress.inventoryItems)],
      items: [...(progress.items ?? latestProgress.items)],
      ...(progress.diagnostic ? { diagnostic: progress.diagnostic } : {}),
      updatedAt: new Date().toISOString(),
    });
  };
  void runFlowWithTimeout(runtime, mission, queued, persistProgress)
    .then((result) => {
      emitRuntimeEvent(runtime, result, {
        event: "amazon_listing_edit_read_sync.flow_finished",
        level: result.ok ? "info" : "warn",
        status: result.ok ? "success" : "review_required",
        stepId: "amazon_listing_edit_read_sync_flow",
        reason: result.reason,
        refs: {
          taskStatus: result.status,
          inventoryCount: String(result.inventoryItems.length),
          itemCount: String(result.items.length),
        },
      });
      return persistAmazonListingEditReadSyncTask(runtime.dataDir, result);
    })
    .catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      emitRuntimeEvent(runtime, latestProgress, {
        event: "amazon_listing_edit_read_sync.flow_failed",
        level: "error",
        status: "failed",
        stepId: "amazon_listing_edit_read_sync_flow",
        reason,
        failureClass: RuntimeFailureClass.INTERNAL_BUG,
      });
      return persistAmazonListingEditReadSyncTask(runtime.dataDir, {
        ...latestProgress,
        ok: false,
        status: "failed",
        reason,
        reachedStep: "flow_failed",
        updatedAt: new Date().toISOString(),
      });
    });
  return running;
};

export const getAmazonListingEditReadSyncTaskStatus = (
  input: { readonly dataDir: string; readonly taskId: string },
): Promise<AmazonListingEditReadSyncTaskRecord | null> =>
  readAmazonListingEditReadSyncTask(input.dataDir, input.taskId);

export const getLatestAmazonListingEditReadSyncTask = (
  input: { readonly dataDir: string },
): Promise<AmazonListingEditReadSyncTaskRecord | null> =>
  readLatestAmazonListingEditReadSyncTask(input.dataDir);
