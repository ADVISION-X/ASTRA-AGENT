import { isLocalAiRuntimeError } from "../../../lib/local-ai/local-ai-runtime-error.js";

type ProtectedGatewayResult<TResult> =
  | { ok: true; result: TResult; gatewayDurationMs: number }
  | { ok: false; message: string; implementationStatus: string; gatewayDurationMs: number; errorKind: string | null; errorDetail: string | null };

function timeoutMessage(timeoutMs: number): string {
  return `Local AI runtime timed out after ${timeoutMs}ms.`;
}

async function executeWithTimeout<TResult>(input: {
  execute: () => Promise<TResult>;
  timeoutMs: number;
}): Promise<ProtectedGatewayResult<TResult>> {
  const controller = new AbortController();
  const startedAtMs = performance.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const gatewayPromise = input.execute();
    const timeoutPromise = new Promise<ProtectedGatewayResult<TResult>>((resolve) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        resolve({
          ok: false,
          message: timeoutMessage(input.timeoutMs),
          implementationStatus: "runtime_timeout",
          gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
          errorKind: "runtime_timeout",
          errorDetail: null,
        });
      }, input.timeoutMs);
    });

    return await Promise.race([
      gatewayPromise.then((value): ProtectedGatewayResult<TResult> => ({
        ok: true,
        result: value,
        gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
      })),
      timeoutPromise,
    ]);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Local AI runtime failed.",
      implementationStatus: "runtime_threw",
      gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
      errorKind: isLocalAiRuntimeError(error) ? error.code : "runtime_threw",
      errorDetail: isLocalAiRuntimeError(error) ? (error.detail ?? null) : null,
    };
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

export { executeWithTimeout };
export type { ProtectedGatewayResult };