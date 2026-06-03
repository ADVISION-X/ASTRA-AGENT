import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createId } from "../../lib/local-runtime/ids.js";
import { RuntimeFailureClass, RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonProductSyncFlow } from "./amazon-product-sync.flow.js";
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

export type AmazonProductSyncRuntime = {
  readonly dataDir: string;
  readonly browser: BrowserController;
  readonly runtimeLogger: RuntimeLogger;
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
      failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE,
      stageName: "amazon_product_sync_flow",
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
    },
  });
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
  void runAmazonProductSyncFlow({
    browser: runtime.browser,
    mission,
    taskId: queued.taskId,
    createdAt: queued.createdAt,
  })
    .then((result) => {
      logFlowFinished(runtime, result);
      return persistAmazonProductSyncTask(runtime.dataDir, result);
    })
    .catch((error) => {
      logFlowFailed(runtime, mission, running, error);
      return persistAmazonProductSyncTask(runtime.dataDir, {
        ...running,
        ok: false,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        reachedStep: "flow_failed",
        updatedAt: new Date().toISOString(),
      });
    });
  return running;
};

export const getAmazonProductSyncTaskStatus = async (
  input: { readonly dataDir: string; readonly taskId: string },
): Promise<AmazonProductSyncTaskRecord | null> => {
  const task = await readAmazonProductSyncTask(input.dataDir, input.taskId);
  return task;
};

export const getLatestAmazonProductSyncTask = (
  input: { readonly dataDir: string },
): Promise<AmazonProductSyncTaskRecord | null> =>
  readLatestAmazonProductSyncTask(input.dataDir);
