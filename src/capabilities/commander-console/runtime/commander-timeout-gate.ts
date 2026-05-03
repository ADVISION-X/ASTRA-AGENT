export type CommanderTimeoutGateResult<T> =
  | {
      timedOut: false;
      value: T;
      timeoutDecision: "within-timeout";
    }
  | {
      timedOut: true;
      timeoutDecision: "timed-out-review-required";
    };

export async function runCommanderTimeoutGate<T>(input: {
  maxDurationMs: number;
  run: () => Promise<T>;
}): Promise<CommanderTimeoutGateResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      input.run().then((value) => ({ kind: "value" as const, value })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ kind: "timeout" }), input.maxDurationMs);
      }),
    ]);

    if (result.kind === "timeout") {
      return {
        timedOut: true,
        timeoutDecision: "timed-out-review-required",
      };
    }

    return {
      timedOut: false,
      value: result.value,
      timeoutDecision: "within-timeout",
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}