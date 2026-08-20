import { createHash, randomUUID } from "node:crypto";

import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  type RuntimeLogger,
} from "../runtime-logs/index.js";

type LoggedBrowserActionInput<T> = {
  runtimeLogger?: RuntimeLogger;
  actionKind: string;
  beforeUrl: string;
  readAfterUrl: () => string;
  run: (browserActionId: string) => Promise<T>;
  isSuccess?: (result: T) => boolean;
  failureReason?: (result: T) => string;
};

export function runLoggedBrowserValueAction<T>(
  input: LoggedBrowserActionInput<T>,
): Promise<T> {
  return runLoggedBrowserAction({
    ...input,
    browserActionId: `browser:${randomUUID()}`,
  });
}

async function runLoggedBrowserAction<T>(
  input: LoggedBrowserActionInput<T> & { browserActionId: string },
): Promise<T> {
  const startedAtMs = Date.now();
  emitBrowserActionStarted(input);
  try {
    const result = await input.run(input.browserActionId);
    const success = input.isSuccess?.(result) ?? true;
    emitBrowserActionTerminal({
      ...input,
      success,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      reason: success
        ? `${input.actionKind} completed`
        : (input.failureReason?.(result) ??
          `${input.actionKind} returned a failed result`),
    });
    return result;
  } catch (error) {
    emitBrowserActionTerminal({
      ...input,
      success: false,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function emitBrowserActionStarted<T>(
  input: LoggedBrowserActionInput<T> & { browserActionId: string },
): void {
  input.runtimeLogger?.emit({
    traceId: input.browserActionId,
    stepId: `browser-${input.actionKind}`,
    capabilityCallId: input.browserActionId,
    owner: "browser-session",
    eventType: RuntimeLogEventType.BROWSER_ACTION_STARTED,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "started",
    reason: `${input.actionKind} started`,
    hashes: { beforeHash: stateHash(input.beforeUrl) },
    payload: {
      actionKind: input.actionKind,
      actionAttemptIndex: 1,
      fallbackUsed: false,
    },
  });
}

function emitBrowserActionTerminal<T>(
  input: LoggedBrowserActionInput<T> & {
    browserActionId: string;
    success: boolean;
    durationMs: number;
    reason: string;
  },
): void {
  if (!input.runtimeLogger) return;
  const common = {
    traceId: input.browserActionId,
    stepId: `browser-${input.actionKind}`,
    capabilityCallId: input.browserActionId,
    owner: "browser-session" as const,
    durationMs: input.durationMs,
    hashes: {
      beforeHash: stateHash(input.beforeUrl),
      afterHash: stateHash(input.readAfterUrl()),
    },
  };
  if (!input.success) {
    input.runtimeLogger.emit({
      ...common,
      eventType: RuntimeLogEventType.BROWSER_ACTION_FAILED,
      level: "warn",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: "failed",
      reason: input.reason.replace(/\s+/g, " ").trim().slice(0, 180),
      payload: {
        actionKind: input.actionKind,
        actionAttemptIndex: 1,
        actionResult: "failed",
        fallbackUsed: false,
        failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
        stageName: `browser-${input.actionKind}`,
        retryable: false,
        terminal: true,
        recoveryPolicy: "owning_flow_decides",
      },
    });
    return;
  }
  input.runtimeLogger.emit({
    ...common,
    eventType: RuntimeLogEventType.BROWSER_ACTION_COMPLETED,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "success",
    reason: input.reason,
    payload: {
      actionKind: input.actionKind,
      actionAttemptIndex: 1,
      actionResult: "success",
      fallbackUsed: false,
      failureClass: null,
    },
  });
}

function stateHash(value: string): string {
  return createHash("sha256")
    .update(value || "about:blank")
    .digest("hex");
}
