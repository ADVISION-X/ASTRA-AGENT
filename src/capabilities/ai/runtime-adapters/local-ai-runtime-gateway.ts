import { isLocalAiRuntimeError } from "../../../lib/local-ai/local-ai-runtime-error-guard.js";
import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";

type ProtectedGatewayResult<TResult> =
  | { ok: true; result: TResult; gatewayDurationMs: number }
  | { ok: false; message: string; implementationStatus: string; gatewayDurationMs: number; errorKind: string | null; errorDetail: string | null };

function timeoutMessage(timeoutMs: number): string {
  return `Local AI runtime timed out after ${timeoutMs}ms.`;
}

function resolveRuntimeSignal(input: {
  signal: AbortSignal | undefined;
  timeoutMs: number;
}): { signal: AbortSignal; timeoutHandle: ReturnType<typeof setTimeout> | null } {
  if (input.signal) {
    return { signal: input.signal, timeoutHandle: null };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort(timeoutMessage(input.timeoutMs));
  }, input.timeoutMs);

  return { signal: controller.signal, timeoutHandle };
}

function resolveAbortMessage(signal: AbortSignal, timeoutMs: number): string {
  return typeof signal.reason === "string" && signal.reason.length > 0
    ? signal.reason
    : timeoutMessage(timeoutMs);
}

async function executeWithTimeout<TResult>(input: {
  execute: (signal: AbortSignal) => Promise<TResult>;
  timeoutMs: number;
  signal: AbortSignal | undefined;
}): Promise<ProtectedGatewayResult<TResult>> {
  const startedAtMs = performance.now();
  const runtimeSignal = resolveRuntimeSignal({ signal: input.signal, timeoutMs: input.timeoutMs });

  try {
    const value = await input.execute(runtimeSignal.signal);
    return {
      ok: true,
      result: value,
      gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
    };
  } catch (error) {
    if (runtimeSignal.signal.aborted) {
      return {
        ok: false,
        message: resolveAbortMessage(runtimeSignal.signal, input.timeoutMs),
        implementationStatus: "runtime_timeout",
        gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
        errorKind: "runtime_timeout",
        errorDetail: null,
      };
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Local AI runtime failed.",
      implementationStatus: "runtime_threw",
      gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
      errorKind: isLocalAiRuntimeError(error) ? error.code : "runtime_threw",
      errorDetail: isLocalAiRuntimeError(error) ? (error.detail ?? null) : null,
    };
  } finally {
    if (runtimeSignal.timeoutHandle !== null) {
      clearTimeout(runtimeSignal.timeoutHandle);
    }
  }
}

export { executeWithTimeout };
export { LocalAiGateway, isLocalAiRuntimeError };
export type { ProtectedGatewayResult };