import { randomUUID } from "node:crypto";
import path from "node:path";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import {
  createRuntimeEvent,
  RuntimeFailureClass,
  RuntimeLogEventType,
  type RuntimeLogger,
} from "../../../lib/runtime-logs/index.js";
import type {
  AiProviderAdapterContext,
  WebChatExecutionContext,
} from "../contracts/ai-provider-adapter.contract.js";
import {
  RENAME_PATROL_SLICE_MS,
  renameSubmittedChatGptConversation,
} from "../providers/web-chat-chat-title.js";
import type {
  WebChatExecutionRecord,
} from "./web-chat-execution-state.js";
import {
  drainWebChatTitleHousekeeping,
  type WebChatTitleHousekeepingSummary,
} from "./web-chat-title-housekeeping.js";
import {
  createSingleTabWebChatBrowser,
  type SingleTabWebChatBrowser,
} from "./web-chat-single-tab-browser.js";

type RenameWorkerState = {
  browser: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
  requested: boolean;
  running: Promise<void> | null;
  timer: NodeJS.Timeout | null;
  stopping: boolean;
};

const workers = new Map<string, RenameWorkerState>();

const noOp = async (): Promise<void> => undefined;

const buildRecoveryExecutionContext = (
  record: WebChatExecutionRecord,
  singleTab: SingleTabWebChatBrowser,
): WebChatExecutionContext => ({
  executionId: record.executionId,
  attemptId: record.attemptId,
  providerKind: record.providerKind,
  systemChatTitle: record.systemChatTitle,
  turnMarker: record.turnMarker,
  submittedPromptHash: record.submittedPromptHash,
  resumeSubmission: record.submission,
  resumeUploadedFiles: record.uploadedFiles,
  resumeAttachmentUploadProof: record.attachmentUploadProof,
  resumeResponseCheckpoint: record.responseCheckpoint,
  resumeForkActionProof: record.forkActionProof,
  globalBrowser: singleTab.globalBrowser,
  runExclusivePatrol: singleTab.runExclusivePatrol,
  onSubmissionObserved: noOp,
  onSubmitted: noOp,
  onConversationCanonicalized: noOp,
  onForkActionObserved: noOp,
  onResponseCaptured: () =>
    Promise.reject(new Error(
      "review_required: title housekeeping cannot create a response checkpoint.",
    )),
});

const executePersistedRename = async (input: {
  dataDir: string;
  browser: BrowserTargetSession;
  record: WebChatExecutionRecord;
}): Promise<NonNullable<WebChatExecutionRecord["submission"]>> => {
  if (
    input.record.providerKind !== "gpt-web-chat"
    || !input.record.submission
  ) {
    return Promise.reject(new Error(
      "review_required: title housekeeping requires one durable ChatGPT submission.",
    ));
  }
  const singleTab = createSingleTabWebChatBrowser({
    base: input.browser,
    dataDir: input.dataDir,
    executionId: input.record.executionId,
    providerKind: input.record.providerKind,
    systemChatTitle: input.record.systemChatTitle,
    turnMarker: input.record.turnMarker,
    timeoutMs: RENAME_PATROL_SLICE_MS,
    initialMutationLease: null,
    resumeSubmission: input.record.submission,
  });
  const context: AiProviderAdapterContext = {
    dataDir: input.dataDir,
    browser: singleTab.browser,
    webChatExecution:
      buildRecoveryExecutionContext(input.record, singleTab),
  };
  return renameSubmittedChatGptConversation({
    browser: singleTab.browser,
    context,
    submission: input.record.submission,
    timeoutMs: RENAME_PATROL_SLICE_MS,
  });
};

const emitRecoverySummary = (
  state: RenameWorkerState,
  summary: WebChatTitleHousekeepingSummary,
): void => {
  if (!state.runtimeLogger || summary.attempted === 0) return;
  if (summary.pending > 0) {
    state.runtimeLogger.emit(createRuntimeEvent({
      context: {
        traceId: `chat-title-housekeeping:${Date.now()}`,
        spanId: randomUUID(),
        owner: "ai-input-gateway",
      },
      eventType: RuntimeLogEventType.RECOVERY_PROGRESS,
      level: "warn",
      modeVisibility: ["DEBUG", "TRACE"],
      status: "started",
      reason:
        "published ChatGPT answers still have durable title housekeeping debt",
      metrics: {
        attempted: summary.attempted,
        verified: summary.verified,
        pending: summary.pending,
        reviewRequired: summary.reviewRequired,
      },
      payload: {
        recoveryKind: "chat_title_housekeeping",
        nextAttemptAt: summary.nextAttemptAt,
        modelName: null,
        promptHash: null,
        inputRefs: [],
        expectedOutputSchemaRef: null,
        rawOutputRef: null,
        rawOutputHash: null,
        parseStatus: "not_requested",
        schemaValidationStatus: "not_applicable",
      },
    }));
    return;
  }
  state.runtimeLogger.emit(createRuntimeEvent({
    context: {
      traceId: `chat-title-housekeeping:${Date.now()}`,
      spanId: randomUUID(),
      owner: "ai-input-gateway",
    },
    eventType: RuntimeLogEventType.RECOVERY_COMPLETED,
    level: "info",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "success",
    reason: "published ChatGPT title housekeeping debt is verified",
    metrics: {
      attempted: summary.attempted,
      verified: summary.verified,
      pending: summary.pending,
      reviewRequired: summary.reviewRequired,
    },
    payload: {
      recoveryKind: "chat_title_housekeeping",
      nextAttemptAt: summary.nextAttemptAt,
      modelName: null,
      promptHash: null,
      inputRefs: [],
      expectedOutputSchemaRef: null,
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "not_requested",
      schemaValidationStatus: "not_applicable",
    },
  }));
};

export const runWebChatTitleHousekeepingNow = async (input: {
  dataDir: string;
  browser: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
}): Promise<WebChatTitleHousekeepingSummary> => {
  const summary = await drainWebChatTitleHousekeeping({
    dataDir: input.dataDir,
    executeRename: (record) => executePersistedRename({
      dataDir: input.dataDir,
      browser: input.browser,
      record,
    }),
  });
  emitRecoverySummary({
    browser: input.browser,
    ...(input.runtimeLogger
      ? { runtimeLogger: input.runtimeLogger }
      : {}),
    requested: false,
    running: null,
    timer: null,
    stopping: false,
  }, summary);
  return summary;
};

const scheduleNextPass = (
  key: string,
  state: RenameWorkerState,
  nextAttemptAt: string | null,
): void => {
  if (!nextAttemptAt || state.timer || state.stopping) return;
  const delayMs = Math.max(
    250,
    Math.min(60_000, new Date(nextAttemptAt).getTime() - Date.now()),
  );
  state.timer = setTimeout(() => {
    state.timer = null;
    if (state.stopping) return;
    state.requested = true;
    startWorker(key, state);
  }, delayMs);
  state.timer.unref();
};

const runWorker = async (
  key: string,
  state: RenameWorkerState,
): Promise<void> => {
  do {
    state.requested = false;
    const summary = await runWebChatTitleHousekeepingNow({
      dataDir: key,
      browser: state.browser,
      ...(state.runtimeLogger
        ? { runtimeLogger: state.runtimeLogger }
        : {}),
    });
    if (summary.pending > 0) {
      scheduleNextPass(key, state, summary.nextAttemptAt);
    }
  } while (state.requested && !state.stopping);
};

const startWorker = (key: string, state: RenameWorkerState): void => {
  if (state.running || state.stopping) return;
  state.running = runWorker(key, state)
    .catch((error: unknown) => {
      if (state.runtimeLogger) {
        state.runtimeLogger.emit(createRuntimeEvent({
          context: {
            traceId: `chat-title-housekeeping:${Date.now()}`,
            spanId: randomUUID(),
            owner: "ai-input-gateway",
          },
          eventType: RuntimeLogEventType.RECOVERY_FAILED,
          level: "error",
          modeVisibility: ["DEBUG", "TRACE"],
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
          payload: {
            recoveryKind: "chat_title_housekeeping",
            failureClass: RuntimeFailureClass.TRANSIENT_RETRYABLE,
            stageName: "chat_title_housekeeping",
            retryable: true,
            terminal: false,
            recoveryPolicy: "retry",
            modelName: null,
            promptHash: null,
            inputRefs: [],
            expectedOutputSchemaRef: null,
            rawOutputRef: null,
            rawOutputHash: null,
            parseStatus: "not_requested",
            schemaValidationStatus: "not_applicable",
          },
        }));
      }
      scheduleNextPass(
        key,
        state,
        new Date(Date.now() + 5_000).toISOString(),
      );
    })
    .finally(() => {
      state.running = null;
      if (state.requested && !state.stopping) startWorker(key, state);
    });
};

export const scheduleWebChatTitleHousekeeping = (input: {
  dataDir: string;
  browser: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
}): void => {
  const key = path.resolve(input.dataDir);
  const existing = workers.get(key);
  const state: RenameWorkerState = existing ?? {
    browser: input.browser,
    requested: false,
    running: null,
    timer: null,
    stopping: false,
  };
  state.browser = input.browser;
  if (input.runtimeLogger) state.runtimeLogger = input.runtimeLogger;
  state.requested = true;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  workers.set(key, state);
  queueMicrotask(() => startWorker(key, state));
};

export const stopWebChatTitleHousekeeping = async (
  dataDir: string,
): Promise<void> => {
  const key = path.resolve(dataDir);
  const state = workers.get(key);
  if (!state) return;
  state.stopping = true;
  state.requested = false;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  await state.running;
  if (state.timer) clearTimeout(state.timer);
  workers.delete(key);
};
