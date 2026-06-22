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

const PICK3_RECOVERY_STAGE = "PICK3_GPT_RATE_LIMIT_RECOVERY" as const;
const PICK3_RATE_LIMIT_WATCH_INTERVAL_MS = 500;
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

// The rate-limit policy has no attempt cap. No reopen, no resend, no restart.
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

const acknowledgeChatGptRateLimitDialog = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<string> => {
  const target = await input.browser.evaluateActiveTab<{ status: string; clickPoint?: { x: number; y: number } }>({
    description: "locate ChatGPT rate-limit acknowledgement button",
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0;
};
const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter(visible);
const scope = dialogs.find((node) => {
  const text = String(node.innerText || node.textContent || "");
  return (text.includes("请求过于频繁") && text.includes("请稍等"))
    || /too many requests|request too frequent|try again later|temporarily limited/i.test(text);
}) || null;
if (!scope) return {status: "rate_limit_dialog_not_found"};
const buttons = Array.from(scope.querySelectorAll('button, [role="button"]')).filter(visible);
const button = buttons.find((node) => {
  const label = String((node.getAttribute("aria-label") || "") + " " + (node.innerText || node.textContent || "")).trim();
  return label.includes("明白") || label.includes("确定") || /ok|got it|understand/i.test(label);
}) || buttons[buttons.length - 1];
if (!button || typeof button.getBoundingClientRect !== "function") return {status: "rate_limit_ack_not_found"};
const rect = button.getBoundingClientRect();
return {status: "rate_limit_ack_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!target.clickPoint || target.status !== "rate_limit_ack_located") return target.status;
  const clicked = await input.browser.click({
    targetLabel: "ChatGPT rate-limit acknowledgement",
    point: target.clickPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) return "rate_limit_ack_click_failed";
  await input.browser.wait(300);
  const verified = await input.browser.evaluateActiveTab<{ status: string }>({
    description: "verify ChatGPT rate-limit acknowledgement closed dialog",
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0;
};
const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter(visible);
const stillVisible = dialogs.some((node) => {
  const text = String(node.innerText || node.textContent || "");
  return (text.includes("请求过于频繁") && text.includes("请稍等"))
    || /too many requests|request too frequent|try again later|temporarily limited/i.test(text);
});
return {status: stillVisible ? "rate_limit_dialog_still_visible_after_ack" : "rate_limit_ack_clicked_and_dialog_closed"};
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  return verified.status;
};

export const isChatGptRateLimitDialogVisible = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<boolean> => input.browser.evaluateActiveTab<boolean>({
  description: "detect visible ChatGPT rate-limit dialog",
  script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0;
};
const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter(visible);
return dialogs.some((node) => {
  const text = String(node.innerText || node.textContent || "");
  return (text.includes("请求过于频繁") && text.includes("请稍等"))
    || /too many requests|request too frequent|try again later|temporarily limited/i.test(text);
});
`,
  ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
});

export const acknowledgePick3RateLimitDialogIfVisible = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  attemptIndex: number;
}): Promise<string | null> => {
  const ackStatus = await acknowledgeChatGptRateLimitDialog(input);
  if (ackStatus === "rate_limit_dialog_not_found") return null;
  const ackSucceeded = ackStatus === "rate_limit_ack_clicked_and_dialog_closed";
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
