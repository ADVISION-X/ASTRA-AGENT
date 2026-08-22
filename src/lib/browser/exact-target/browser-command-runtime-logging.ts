import type { RuntimeLogger } from "../../runtime-logs/index.js";
import {
  createRuntimeEvent,
  RuntimeFailureClass,
  RuntimeLogEventType,
} from "../../runtime-logs/index.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";

type BrowserCommandLogBase = Readonly<{
  runtimeLogger: RuntimeLogger;
  permit: BrowserCommandPermit;
  beforeHash: string;
}>;

const contextFor = (permit: BrowserCommandPermit) => ({
  traceId: permit.commandId,
  missionId: permit.jobId,
  runId: permit.localOrderId,
  stepId: permit.capabilityId,
  spanId: `${permit.commandId}:${permit.sequence}`,
  owner: "browser-session" as const,
});

const commonFields = (permit: BrowserCommandPermit) => ({
  context: contextFor(permit),
  modeVisibility: ["FLOW", "DEBUG", "TRACE"] as Array<"FLOW" | "DEBUG" | "TRACE">,
  capabilityCallId: permit.commandId,
  refs: {
    authorityRef: permit.authorityRef,
    targetRef: permit.targetRef,
    documentRef: permit.documentRef,
  },
});

export const emitBrowserCommandStarted = (
  input: BrowserCommandLogBase,
): void => {
  input.runtimeLogger.emit(createRuntimeEvent({
    ...commonFields(input.permit),
    level: "info",
    eventType: RuntimeLogEventType.BROWSER_ACTION_STARTED,
    status: "started",
    hashes: { beforeHash: input.beforeHash },
    payload: {
      actionResult: "started",
      fallbackUsed: false,
    },
  }));
};

export const emitBrowserCommandCompleted = (
  input: BrowserCommandLogBase & Readonly<{
    afterHash: string;
    durationMs: number;
  }>,
): void => {
  input.runtimeLogger.emit(createRuntimeEvent({
    ...commonFields(input.permit),
    level: "info",
    eventType: RuntimeLogEventType.BROWSER_ACTION_COMPLETED,
    status: "success",
    durationMs: input.durationMs,
    hashes: {
      beforeHash: input.beforeHash,
      afterHash: input.afterHash,
    },
    payload: {
      actionResult: "success",
      failureClass: null,
      fallbackUsed: false,
    },
  }));
};

export const emitBrowserCommandFailed = (
  input: BrowserCommandLogBase & Readonly<{
    afterHash: string;
    durationMs: number;
    failureCode: string;
    outcomeUnknown: boolean;
  }>,
): void => {
  input.runtimeLogger.emit(createRuntimeEvent({
    ...commonFields(input.permit),
    level: "error",
    eventType: RuntimeLogEventType.BROWSER_ACTION_FAILED,
    status: input.outcomeUnknown ? "review_required" : "failed",
    reason: input.failureCode,
    durationMs: input.durationMs,
    hashes: {
      beforeHash: input.beforeHash,
      afterHash: input.afterHash,
    },
    payload: {
      actionResult: input.outcomeUnknown ? "unknown" : "failed",
      failureClass: input.outcomeUnknown
        ? RuntimeFailureClass.BROWSER_OUTCOME_UNKNOWN
        : RuntimeFailureClass.BROWSER_LIVENESS_FAILURE,
      fallbackUsed: false,
    },
  }));
};
