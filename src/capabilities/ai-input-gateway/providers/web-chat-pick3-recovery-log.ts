import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createMissionTrace,
  createRuntimeEvent,
  type RuntimeLogger,
} from "../../../lib/runtime-logs/index.js";
import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  acknowledgeChatGptRateLimitDialogIfVisible as acknowledgeGenericChatGptRateLimitDialogIfVisible,
  isChatGptRateLimitDialogVisible,
} from "./web-chat-rate-limit-dialog.js";

const PICK3_RECOVERY_STAGE = "PICK3_GPT_RATE_LIMIT_RECOVERY" as const;
const PICK3_RATE_LIMIT_WATCH_INTERVAL_MS = 500;
// The shared locator remains dialog-scoped: querySelectorAll('[role="dialog"], [data-radix-portal]')
// plus alertdialog/aria-modal variants; never fall back to the whole document body.
// Visible dialog text is read through node.innerText in the shared acknowledgement helper.
const pick3RateLimitAttemptsByMission = new Map<string, number>();
const pick3RateLimitGuardsByMission = new Map<string, Promise<void>>();

type Pick3RecoveryLogInput = {
  logger: RuntimeLogger | undefined;
  request: AiFeedInput;
  reason: string;
  status: "started" | "success" | "failed" | "review_required";
  attemptIndex: number;
  waitMs?: number;
  remainingMs?: number;
  refs?: Record<string, string>;
};

type Pick3RateLimitGuardInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
};

type Pick3RateLimitDialogWatcher = {
  stop: () => Promise<void>;
};

const pick3RateLimitMissionKey = (request: AiFeedInput): string =>
  request.missionId ?? request.runId ?? request.roundId ?? request.promptPackageId;

export const reservePick3RateLimitAttempt = (request: AiFeedInput): number => {
  const missionKey = pick3RateLimitMissionKey(request);
  const attemptIndex = pick3RateLimitAttemptsByMission.get(missionKey) ?? 0;
  pick3RateLimitAttemptsByMission.set(missionKey, attemptIndex + 1);
  return attemptIndex;
};

// The rate-limit policy has no attempt cap: click, refresh the same tab, never resend or restart.
const buildPick3RecoveryRefs = (input: Pick3RecoveryLogInput): Record<string, string> => ({
  imageId: input.request.inputRefs[0]?.id ?? "missing-image-id",
  promptPackageId: input.request.promptPackageId,
  promptContractId: input.request.promptContractId,
  missionKey: pick3RateLimitMissionKey(input.request),
  attempt: String(input.attemptIndex + 1),
  totalWaitSec: input.waitMs === undefined ? "0" : String(Math.round(input.waitMs / 1000)),
  remainingSec: input.waitMs === undefined ? "0" : String(Math.round((input.remainingMs ?? input.waitMs) / 1000)),
  elapsedSec: input.waitMs === undefined ? "0" : String(Math.round(input.waitMs - (input.remainingMs ?? input.waitMs)) / 1000),
  recoveryAction: input.reason,
  ...(input.refs ?? {}),
});

export const emitPick3RateLimitRecoveryLog = (input: Pick3RecoveryLogInput): void => {
  if (!input.logger) return;
  const childCapabilityId = input.request.providerKind === "gpt-web-chat" ? "feed-gpt-web-chat-once" : "feed-gemini-web-chat-once";
  const eventType = input.reason.endsWith("_waiting")
    ? RuntimeLogEventType.RECOVERY_PROGRESS
    : input.status === "started"
      ? RuntimeLogEventType.RECOVERY_STARTED
      : input.status === "success"
        ? RuntimeLogEventType.RECOVERY_COMPLETED
        : RuntimeLogEventType.RECOVERY_FAILED;
  const traceContext = createMissionTrace({
    missionId: input.request.missionId ?? input.request.promptPackageId,
    runId: input.request.runId ?? input.request.roundId ?? input.request.promptPackageId,
    owner: "ai-input-gateway",
  });
  input.logger.emit(createRuntimeEvent({
    context: traceContext,
    level: input.status === "failed" || input.status === "review_required" ? "warn" : "info",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType,
    status: input.status,
    reason: input.reason,
    refs: buildPick3RecoveryRefs(input),
    metrics: {
      attempt: input.attemptIndex + 1,
      ...(input.waitMs !== undefined ? { waitMs: input.waitMs } : {}),
      ...(input.remainingMs !== undefined ? { remainingMs: input.remainingMs } : {}),
    },
    payload: {
      abilityGroupId: "ai-input-gateway",
      childCapabilityId,
      providerKind: input.request.providerKind,
      modelName: input.request.modelName,
      promptHash: input.request.promptPackageId,
      inputRefs: input.request.inputRefs.map((ref) => ref.id),
      expectedOutputSchemaRef: input.request.expectedOutputSchemaRef,
      timeoutMs: input.request.timeoutMs,
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "not_requested",
      schemaValidationStatus: "not_applicable",
      failureClass: RuntimeFailureClass.PLATFORM_RATE_LIMIT,
      stageName: PICK3_RECOVERY_STAGE,
      retryable: true,
      terminal: false,
      recoveryPolicy: "retry",
    },
  }));
};

const terminalLog = (line: string): void => {
  process.stdout.write(`[GRASSEYE][PICK3][RATE_LIMIT] ${line}\n`);
};

const terminalRecoveryLog = (input: Pick3RecoveryLogInput & { phase: string }): void => {
  const refs = buildPick3RecoveryRefs(input);
  terminalLog(`mission=${refs.missionKey} imageId=${refs.imageId} promptPackageId=${refs.promptPackageId} attempt=${refs.attempt} phase=${input.phase} totalWaitSec=${refs.totalWaitSec} elapsedSec=${refs.elapsedSec} remainingSec=${refs.remainingSec} recoveryAction=${refs.recoveryAction} — ${input.reason}`);
};

export const acknowledgePick3RateLimitDialogIfVisible = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  attemptIndex: number;
}): Promise<string | null> => {
  const ackStatus = await acknowledgeGenericChatGptRateLimitDialogIfVisible(input);
  if (ackStatus === null) return null;
  const ackSucceeded = ackStatus === "rate_limit_ack_clicked_and_same_tab_refreshed";
  emitPick3RateLimitRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, reason: ackSucceeded ? "pick3_rate_limit_immediate_acknowledgement_completed" : "pick3_rate_limit_immediate_acknowledgement_pending_retry", status: ackSucceeded ? "success" : "started", refs: { ackStatus } });
  terminalRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, reason: `ackStatus=${ackStatus}`, status: ackSucceeded ? "success" : "started", phase: "immediate_acknowledgement_result", refs: { ackStatus, recoveryAction: ackSucceeded ? "pick3_rate_limit_immediate_acknowledgement_completed" : "pick3_rate_limit_immediate_acknowledgement_pending_retry" } });
  if (!ackSucceeded) return "pick3_rate_limit_immediate_ack_pending_retry";
  return "pick3_rate_limit_immediate_ack_clicked";
};

const isPick3GptRateLimitGuardRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat" && request.promptContractId.includes("pick3-is-blind-eval");

const currentPick3RateLimitAttemptIndex = (request: AiFeedInput): number =>
  Math.max(0, (pick3RateLimitAttemptsByMission.get(pick3RateLimitMissionKey(request)) ?? 1) - 1);

export const acknowledgePick3RateLimitIfVisible = async (input: Pick3RateLimitGuardInput): Promise<void> => {
  if (!isPick3GptRateLimitGuardRequest(input.request)) return;
  const missionKey = pick3RateLimitMissionKey(input.request);
  const existingGuard = pick3RateLimitGuardsByMission.get(missionKey);
  if (existingGuard) {
    await existingGuard;
    return;
  }
  const guard = (async (): Promise<void> => {
    if (!await isChatGptRateLimitDialogVisible(input)) return;
    const rateLimitAttempt = reservePick3RateLimitAttempt(input.request);
    await acknowledgePick3RateLimitDialogIfVisible({
      browser: input.browser,
      request: input.request,
      context: input.context,
      attemptIndex: rateLimitAttempt,
    });
  })();
  pick3RateLimitGuardsByMission.set(missionKey, guard);
  try {
    await guard;
  } finally {
    if (pick3RateLimitGuardsByMission.get(missionKey) === guard) {
      pick3RateLimitGuardsByMission.delete(missionKey);
    }
  }
};

export const startPick3RateLimitDialogWatcher = (input: Pick3RateLimitGuardInput): Pick3RateLimitDialogWatcher | null => {
  if (!isPick3GptRateLimitGuardRequest(input.request)) return null;
  let stopped = false;
  let running = false;
  let failure: unknown = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (): void => {
    if (!stopped) {
      timer = setTimeout(() => void tick(), PICK3_RATE_LIMIT_WATCH_INTERVAL_MS);
    }
  };
  const tick = async (): Promise<void> => {
    if (stopped || running) {
      schedule();
      return;
    }
    running = true;
    try {
      await acknowledgePick3RateLimitIfVisible(input);
    } catch (error) {
      emitPick3RateLimitRecoveryLog({
        logger: input.context.runtimeLogger,
        request: input.request,
        attemptIndex: currentPick3RateLimitAttemptIndex(input.request),
        reason: "pick3_rate_limit_dialog_watcher_failed",
        status: "failed",
        refs: { failureMessage: error instanceof Error ? error.message : String(error) },
      });
      failure = error;
      stopped = true;
    } finally {
      running = false;
      schedule();
    }
  };
  terminalRecoveryLog({
    logger: input.context.runtimeLogger,
    request: input.request,
    attemptIndex: 0,
    reason: "pick3_rate_limit_dialog_watcher_started",
    status: "started",
    phase: "dialog_watcher_started",
    refs: { recoveryAction: "pick3_rate_limit_dialog_watcher_started" },
  });
  schedule();
  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      for (let index = 0; running && index < 20; index += 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      if (failure) {
        emitPick3RateLimitRecoveryLog({
          logger: input.context.runtimeLogger,
          request: input.request,
          attemptIndex: currentPick3RateLimitAttemptIndex(input.request),
          reason: "pick3_rate_limit_dialog_watcher_stop_failed",
          status: "failed",
          refs: { failureMessage: failure instanceof Error ? failure.message : String(failure) },
        });
        throw failure;
      }
    },
  };
};
