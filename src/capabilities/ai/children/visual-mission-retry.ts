import { RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";
import type { AiAbilityInput } from "../contract.js";
import { callOnlineVisualMissionModel } from "../runtime/model-call.js";
import type { RuntimeLogger, TraceContext } from "../runtime/model-call.js";

const TRANSIENT_MODEL_RETRY_DELAYS_MS = [60_000, 240_000, 300_000] as const;

type RetryInput = {
  dataDir: string;
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
  spanId: string;
};

const waitWithAbort = (delayMs: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, delayMs));
  if (signal.aborted) return Promise.reject(new Error("AI transient retry aborted."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("AI transient retry aborted."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const isTransientGeminiModelError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /\bGemini HTTP (429|503)\b/.test(message) ||
    message.includes("Quota exceeded") ||
    message.includes("Please retry") ||
    message.includes("currently experiencing high demand");
};

const emitTransientRetryWait = (input: RetryInput, attemptIndex: number, retryDelayMs: number, message: string): void => {
  input.runtimeLogger?.emit({
    eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
    level: "warn",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    owner: "ai-capability",
    traceId: input.traceContext?.traceId ?? input.request.missionId ?? "no-trace",
    spanId: input.spanId,
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    status: "failed",
    reason: "visual_mission_judgment_transient_retry_wait",
    actionableMessage: `Transient Gemini error on attempt ${attemptIndex + 1}; waiting ${retryDelayMs}ms before retry. ${message}`,
    ownerResponsible: "ai-capability",
    metrics: { attemptIndex, retryDelayMs, remainingRetryCount: TRANSIENT_MODEL_RETRY_DELAYS_MS.length - attemptIndex },
  });
};

export const callModelWithTransientRetry = async (input: RetryInput) => {
  let lastError: unknown = null;
  for (let attemptIndex = 0; attemptIndex <= TRANSIENT_MODEL_RETRY_DELAYS_MS.length; attemptIndex += 1) {
    try {
      return await callOnlineVisualMissionModel(input);
    } catch (error) {
      lastError = error;
      const retryDelayMs = TRANSIENT_MODEL_RETRY_DELAYS_MS[attemptIndex];
      if (!isTransientGeminiModelError(error) || retryDelayMs === undefined) throw error;
      emitTransientRetryWait(input, attemptIndex, retryDelayMs, error instanceof Error ? error.message : String(error));
      await waitWithAbort(retryDelayMs, input.signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Gemini transient retry failed."));
};
