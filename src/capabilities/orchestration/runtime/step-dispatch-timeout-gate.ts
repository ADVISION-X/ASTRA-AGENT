export type TimeoutGateResult<T> =
  | { timedOut: false; result: T }
  | { timedOut: true };

export async function dispatchWithTimeout<T>(
  dispatchFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<TimeoutGateResult<T>> {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutHandle = setTimeout(() => {
    controller.abort(new Error(`Step dispatch timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const result = await Promise.race<T | typeof TIMED_OUT_SENTINEL>([
      dispatchFn(signal),
      new Promise<typeof TIMED_OUT_SENTINEL>((resolve) => {
        signal.addEventListener("abort", () => { resolve(TIMED_OUT_SENTINEL); }, { once: true });
      }),
    ]);
    if (result === TIMED_OUT_SENTINEL) {
      return { timedOut: true };
    }
    return { timedOut: false, result: result as T };
  } finally {
    clearTimeout(timeoutHandle);
    if (!signal.aborted) {
      controller.abort();
    }
  }
}

const TIMED_OUT_SENTINEL: unique symbol = Symbol("TIMED_OUT_SENTINEL");
