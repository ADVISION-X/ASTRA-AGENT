import { isLocalAiRuntimeError } from "../../../lib/local-ai/local-ai-runtime-error-guard.js";
import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";

type ProtectedGatewayResult<TResult> =
  | { ok: true; result: TResult; gatewayDurationMs: number }
  | { ok: false; message: string; implementationStatus: string; gatewayDurationMs: number; errorKind: string | null; errorDetail: string | null };

type GatewayExecutionOutcome<TResult> =
  | { kind: "success"; result: TResult }
  | { kind: "failure"; error: unknown }
  | { kind: "aborted" };

function timeoutMessage(timeoutMs: number): string {
  return `Local AI runtime timed out after ${timeoutMs}ms.`;
}

function resolveRuntimeSignal(input: {
  signal: AbortSignal | undefined;
  timeoutMs: number;
}): { signal: AbortSignal; timeoutHandle: ReturnType<typeof setTimeout>; controller: AbortController } {
  const controller = new AbortController();
  const signal = input.signal
    ? AbortSignal.any([input.signal, controller.signal])
    : controller.signal;
  const timeoutHandle = setTimeout(() => {
    controller.abort(timeoutMessage(input.timeoutMs));
  }, input.timeoutMs);

  return { signal, timeoutHandle, controller };
}

function resolveAbortMessage(signal: AbortSignal, timeoutMs: number): string {
  return typeof signal.reason === "string" && signal.reason.length > 0
    ? signal.reason
    : timeoutMessage(timeoutMs);
}

function waitForAbort(signal: AbortSignal): Promise<GatewayExecutionOutcome<never>> {
  if (signal.aborted) {
    return Promise.resolve({ kind: "aborted" });
  }

  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve({ kind: "aborted" }), { once: true });
  });
}

function buildTimeoutFailure(signal: AbortSignal, timeoutMs: number, startedAtMs: number): ProtectedGatewayResult<never> {
  return {
    ok: false,
    message: resolveAbortMessage(signal, timeoutMs),
    implementationStatus: "runtime_timeout",
    gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
    errorKind: "runtime_timeout",
    errorDetail: null,
  };
}

function buildRuntimeErrorFailure(error: unknown, startedAtMs: number): ProtectedGatewayResult<never> {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Local AI runtime failed.",
    implementationStatus: "runtime_threw",
    gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
    errorKind: isLocalAiRuntimeError(error) ? error.code : "runtime_threw",
    errorDetail: isLocalAiRuntimeError(error) ? (error.detail ?? null) : null,
  };
}

function createExecutionOutcomePromise<TResult>(
  input: { execute: (signal: AbortSignal) => Promise<TResult> },
  signal: AbortSignal,
): Promise<GatewayExecutionOutcome<TResult>> {
  return Promise.resolve()
    .then(() => input.execute(signal))
    .then((result) => ({ kind: "success", result } as const))
    .catch((error: unknown) => ({ kind: "failure", error } as const));
}

async function executeWithTimeout<TResult>(input: {
  execute: (signal: AbortSignal) => Promise<TResult>;
  timeoutMs: number;
  signal: AbortSignal | undefined;
}): Promise<ProtectedGatewayResult<TResult>> {
  const startedAtMs = performance.now();
  const runtimeSignal = resolveRuntimeSignal({ signal: input.signal, timeoutMs: input.timeoutMs });

  try {
    if (runtimeSignal.signal.aborted) {
      return buildTimeoutFailure(runtimeSignal.signal, input.timeoutMs, startedAtMs);
    }

    const executionPromise = createExecutionOutcomePromise(input, runtimeSignal.signal);
    const outcome = await Promise.race([executionPromise, waitForAbort(runtimeSignal.signal)]);

    if (outcome.kind === "aborted") {
      return buildTimeoutFailure(runtimeSignal.signal, input.timeoutMs, startedAtMs);
    }

    if (outcome.kind === "failure") {
      return buildRuntimeErrorFailure(outcome.error, startedAtMs);
    }

    return {
      ok: true,
      result: outcome.result,
      gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
    };
  } finally {
    clearTimeout(runtimeSignal.timeoutHandle);
  }
}

export { executeWithTimeout };
export { LocalAiGateway, isLocalAiRuntimeError };
export type { ProtectedGatewayResult };