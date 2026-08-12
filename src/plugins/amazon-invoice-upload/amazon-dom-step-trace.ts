import { createRuntimeEvent, RuntimeFailureClass, RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  buildAmazonDomTraceBaseEvent,
  resolveAmazonDomRuntimeStatus,
  type AmazonDomStepTraceContext,
} from "./amazon-dom-step-trace-support.js";

export function startAmazonDomStepTrace(input: {
  runtimeLogger: RuntimeLogger;
  mission: AmazonDomStepTraceContext["mission"];
  stepName: string;
  traceId?: string;
  taskId?: string;
  runtimeLogRef?: string;
}): number {
  const startedAtMs = Date.now();
  const baseEvent = buildAmazonDomTraceBaseEvent({
    mission: input.mission,
    stepName: input.stepName,
    status: "snapshot",
    traceId: input.traceId,
    taskId: input.taskId,
    runtimeLogRef: input.runtimeLogRef,
  });
  input.runtimeLogger.emit({
    ...baseEvent,
    eventType: RuntimeLogEventType.DOM_AUTOMATION_STEP_STARTED,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "started",
    reason: input.stepName,
  });
  return startedAtMs;
}

export function recordAmazonDomStepTrace(input: {
  runtimeLogger: RuntimeLogger;
  startedAtMs?: number;
  startedAlready?: boolean;
} & AmazonDomStepTraceContext): void {
  const baseEvent = buildAmazonDomTraceBaseEvent(input);
  if (input.startedAlready !== true) {
    input.runtimeLogger.emit({
      ...baseEvent,
      eventType: RuntimeLogEventType.DOM_AUTOMATION_STEP_STARTED,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      status: "started",
      reason: input.stepName,
    });
  }
  input.runtimeLogger.emit({
    ...baseEvent,
    eventType: input.status === "success" || input.status === "snapshot"
      ? RuntimeLogEventType.DOM_AUTOMATION_STEP_COMPLETED
      : RuntimeLogEventType.DOM_AUTOMATION_STEP_FAILED,
    level: input.status === "success" || input.status === "snapshot" ? "info" : "warn",
    modeVisibility: input.status === "success" || input.status === "snapshot" ? ["DEBUG", "TRACE"] : ["FLOW", "DEBUG", "TRACE"],
    status: resolveAmazonDomRuntimeStatus(input.status),
    reason: input.reason?.replace(/\s+/g, " ").trim().slice(0, 140) || input.stepName,
    durationMs: input.startedAtMs === undefined ? 0 : Math.max(0, Date.now() - input.startedAtMs),
  });
}

export function emitAmazonOrderDetailNavigationStarted(input: {
  runtimeLogger: RuntimeLogger;
  executionId: string;
  browserActionId: string;
  beforeHash: string;
  runtimeLogRef: string;
  amazonOrderId: string;
  taskId?: string;
}): void {
  input.runtimeLogger.emit(createRuntimeEvent({
    context: {
      traceId: input.executionId,
      spanId: input.browserActionId,
      missionId: input.executionId,
      runId: input.executionId,
      stepId: "amazon-invoice-order-detail-navigation",
      owner: "amazon-invoice-upload",
    },
    capabilityCallId: input.browserActionId,
    eventType: RuntimeLogEventType.BROWSER_ACTION_STARTED,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "started",
    reason: "Open approved Amazon order detail exactly once.",
    refs: { runtimeLogRef: input.runtimeLogRef, orderId: input.amazonOrderId, ...(input.taskId ? { taskId: input.taskId } : {}) },
    hashes: { beforeHash: input.beforeHash },
    payload: { actionKind: "open", actionAttemptIndex: 1, fallbackUsed: false },
  }));
}

type OrderDetailNavigationTerminalInput = {
  runtimeLogger: RuntimeLogger;
  executionId: string;
  browserActionId: string;
  runtimeLogRef: string;
  taskId?: string;
  evidenceRef?: string;
  actionResult: "success" | "failed";
  beforeHash: string;
  afterHash: string;
  durationMs: number;
  navigationMode: string;
  observedUrlMatchesRequest: boolean;
  reason: string;
};

export function emitAmazonOrderDetailNavigationTerminal(input: OrderDetailNavigationTerminalInput): void {
  if (input.actionResult === "failed") {
    emitFailedOrderDetailNavigation(input);
    return;
  }
  emitCompletedOrderDetailNavigation(input);
}

function emitFailedOrderDetailNavigation(input: OrderDetailNavigationTerminalInput): void {
  input.runtimeLogger.emit(createRuntimeEvent({
      context: {
        traceId: input.executionId,
        spanId: input.browserActionId,
        missionId: input.executionId,
        runId: input.executionId,
        stepId: "amazon-invoice-order-detail-navigation",
        owner: "amazon-invoice-upload",
      },
      capabilityCallId: input.browserActionId,
      eventType: RuntimeLogEventType.BROWSER_ACTION_FAILED,
      level: "warn",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: "failed",
      reason: input.reason.replace(/\s+/g, " ").trim().slice(0, 180),
      durationMs: input.durationMs,
      refs: { runtimeLogRef: input.runtimeLogRef, ...(input.taskId ? { taskId: input.taskId } : {}), ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}) },
      hashes: { beforeHash: input.beforeHash, afterHash: input.afterHash },
      payload: {
        actionKind: "open",
        actionAttemptIndex: 1,
        actionResult: input.actionResult,
        navigationMode: input.navigationMode,
        observedUrlMatchesRequest: input.observedUrlMatchesRequest,
        fallbackUsed: false,
        failureClass: RuntimeFailureClass.NAVIGATION_FAILURE,
        stageName: "amazon-invoice-order-detail-navigation",
        retryable: false,
        terminal: true,
        recoveryPolicy: "review_required_without_repeat_navigation",
      },
  }));
}

function emitCompletedOrderDetailNavigation(input: OrderDetailNavigationTerminalInput): void {
  input.runtimeLogger.emit(createRuntimeEvent({
    context: {
      traceId: input.executionId,
      spanId: input.browserActionId,
      missionId: input.executionId,
      runId: input.executionId,
      stepId: "amazon-invoice-order-detail-navigation",
      owner: "amazon-invoice-upload",
    },
    capabilityCallId: input.browserActionId,
    eventType: RuntimeLogEventType.BROWSER_ACTION_COMPLETED,
    level: "info",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "success",
    reason: input.reason.replace(/\s+/g, " ").trim().slice(0, 180),
    durationMs: input.durationMs,
    refs: { runtimeLogRef: input.runtimeLogRef, ...(input.taskId ? { taskId: input.taskId } : {}), ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}) },
    hashes: { beforeHash: input.beforeHash, afterHash: input.afterHash },
    payload: {
      actionKind: "open",
      actionAttemptIndex: 1,
      actionResult: input.actionResult,
      navigationMode: input.navigationMode,
      observedUrlMatchesRequest: input.observedUrlMatchesRequest,
      fallbackUsed: false,
      failureClass: null,
    },
  }));
}
