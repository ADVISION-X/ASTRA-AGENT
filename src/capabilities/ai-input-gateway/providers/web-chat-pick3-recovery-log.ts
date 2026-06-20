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

const HEARTBEAT_MS = 30_000;
const PICK3_RECOVERY_STAGE = "PICK3_GPT_RATE_LIMIT_RECOVERY" as const;
const PICK3_RATE_LIMIT_BACKOFF_MS = [600_000, 600_000, 600_000] as const;
const pick3RateLimitAttemptsByMission = new Map<string, number>();

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

const pick3RateLimitMissionKey = (request: AiFeedInput): string =>
  request.missionId ?? request.runId ?? request.roundId ?? request.promptPackageId;

export const reservePick3RateLimitAttempt = (request: AiFeedInput): number => {
  const missionKey = pick3RateLimitMissionKey(request);
  const attemptIndex = pick3RateLimitAttemptsByMission.get(missionKey) ?? 0;
  pick3RateLimitAttemptsByMission.set(missionKey, attemptIndex + 1);
  return attemptIndex;
};

export const resolvePick3RateLimitBackoffMs = (attemptIndex: number): number | null =>
  PICK3_RATE_LIMIT_BACKOFF_MS[attemptIndex] ?? null;

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

export const emitPick3RateLimitRecoveryStep = (input: Pick3RecoveryLogInput & { phase: string }): void => {
  emitPick3RateLimitRecoveryLog(input);
  terminalRecoveryLog(input);
};

export const waitWithPick3RateLimitHeartbeat = async (input: {
  logger: RuntimeLogger | undefined;
  request: AiFeedInput;
  attemptIndex: number;
  waitMs: number;
  wait: (durationMs: number) => Promise<unknown>;
}): Promise<void> => {
  emitPick3RateLimitRecoveryLog({
    ...input,
    reason: "pick3_rate_limit_backoff_started",
    status: "started",
  });
  terminalRecoveryLog({ ...input, phase: "backoff_started", reason: "ChatGPT rate-limited; waiting silently before retry", status: "started", refs: { recoveryAction: "pick3_rate_limit_backoff_started" } });
  let remainingMs = input.waitMs;
  try {
    while (remainingMs > 0) {
      const chunkMs = Math.min(remainingMs, HEARTBEAT_MS);
      await input.wait(chunkMs);
      remainingMs -= chunkMs;
      emitPick3RateLimitRecoveryLog({
        ...input,
        reason: "pick3_rate_limit_backoff_waiting",
        status: "started",
        remainingMs,
      });
      terminalRecoveryLog({ ...input, phase: "backoff_waiting", reason: "still waiting, do NOT interrupt", status: "started", remainingMs, refs: { recoveryAction: "pick3_rate_limit_backoff_waiting" } });
    }
    emitPick3RateLimitRecoveryLog({
      ...input,
      reason: "pick3_rate_limit_backoff_elapsed",
      status: "success",
    });
    terminalRecoveryLog({ ...input, phase: "backoff_elapsed", reason: "wait complete; clicking acknowledgement and retrying", status: "success", remainingMs: 0, refs: { recoveryAction: "pick3_rate_limit_backoff_elapsed" } });
  } catch (error) {
    emitPick3RateLimitRecoveryLog({
      ...input,
      reason: "pick3_rate_limit_backoff_wait_failed",
      status: "failed",
      refs: { error: error instanceof Error ? error.message : String(error) },
    });
    terminalRecoveryLog({ ...input, phase: "backoff_wait_failed", reason: error instanceof Error ? error.message : String(error), status: "failed", refs: { recoveryAction: "pick3_rate_limit_backoff_wait_failed" } });
    throw error;
  }
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
  return clicked.ok ? "rate_limit_ack_clicked" : "rate_limit_ack_click_failed";
};

export const waitAfterPick3RateLimit = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  attemptIndex: number;
  backoffMs: number;
}): Promise<string> => {
  await waitWithPick3RateLimitHeartbeat({
    logger: input.context.runtimeLogger,
    request: input.request,
    attemptIndex: input.attemptIndex,
    waitMs: input.backoffMs,
    wait: (durationMs) => input.browser.wait(durationMs),
  });
  emitPick3RateLimitRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "pick3_rate_limit_acknowledgement_started", status: "started" });
  terminalRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "clicking acknowledgement dialog", status: "started", phase: "acknowledgement_started", refs: { recoveryAction: "pick3_rate_limit_acknowledgement_started" } });
  const ackStatus = await acknowledgeChatGptRateLimitDialog(input);
  emitPick3RateLimitRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: ackStatus === "rate_limit_ack_clicked" ? "pick3_rate_limit_acknowledgement_completed" : "pick3_rate_limit_acknowledgement_failed", status: ackStatus === "rate_limit_ack_clicked" ? "success" : "review_required", refs: { ackStatus } });
  terminalRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: `ackStatus=${ackStatus}`, status: ackStatus === "rate_limit_ack_clicked" ? "success" : "review_required", phase: "acknowledgement_result", refs: { ackStatus, recoveryAction: ackStatus === "rate_limit_ack_clicked" ? "pick3_rate_limit_acknowledgement_completed" : "pick3_rate_limit_acknowledgement_failed" } });
  emitPick3RateLimitRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "pick3_rate_limit_chatgpt_refresh_started", status: "started" });
  terminalRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "reopening ChatGPT new chat", status: "started", phase: "chatgpt_refresh_started", refs: { recoveryAction: "pick3_rate_limit_chatgpt_refresh_started" } });
  await input.browser.open({
    url: "https://chatgpt.com/",
    title: "Refresh ChatGPT after Pick3 rate-limit backoff",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(1_800);
  emitPick3RateLimitRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "pick3_rate_limit_chatgpt_refresh_completed", status: "success" });
  terminalRecoveryLog({ logger: input.context.runtimeLogger, request: input.request, attemptIndex: input.attemptIndex, waitMs: input.backoffMs, reason: "ready to resend prompt", status: "success", phase: "chatgpt_refresh_completed", refs: { recoveryAction: "pick3_rate_limit_chatgpt_refresh_completed" } });
  return `pick3_rate_limit_backoff_${input.backoffMs}_ms_then_${ackStatus}_and_refreshed`;
};
