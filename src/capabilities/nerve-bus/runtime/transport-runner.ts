import { createId } from "../../../lib/local-runtime/ids.js";

import type { NerveBusHandlerPort, NerveBusHandledResult } from "../ports/nerve-bus-handler-port.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";

export type NerveBusRunnerOutcome<TResult extends SupportedResultEnvelope> =
  | {
    kind: "handled";
    resultEnvelope: TResult;
    outputPayload: NerveBusPayloadDocument | null;
    handlerDecision: "executed";
    failureReason: string | null;
    reviewRequiredReason: string | null;
    timeoutDecision: "within_timeout";
    handlerCallId: string;
    handlerStartedAt: string;
    handlerEndedAt: string;
    handlerDurationMs: number;
    circuitBreakerState: "closed";
  }
  | {
    kind: "handler_failed";
    outputPayload: null;
    handlerDecision: "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted";
    failureReason: string;
    reviewRequiredReason: null;
    timeoutDecision: "within_timeout" | "timed_out";
    handlerCallId: string;
    handlerStartedAt: string;
    handlerEndedAt: string;
    handlerDurationMs: number;
    circuitBreakerState: "closed";
  };

type TimedRaceResult<T> =
  | { kind: "resolved"; value: T }
  | { kind: "timed_out" }
  | { kind: "threw"; error: unknown };

type TransportResultSchema<TResult extends SupportedResultEnvelope> = {
  parse(data: unknown): TResult;
  safeParse(data: unknown):
    | { success: true; data: TResult }
    | { success: false; error: { message: string } };
};

async function raceWithTimeout<T>(input: {
  promise: Promise<T>;
  timeoutMs: number;
  onTimeout(): void;
}): Promise<TimedRaceResult<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      input.onTimeout();
      resolve({ kind: "timed_out" });
    }, input.timeoutMs);
    void input.promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ kind: "resolved", value });
      },
      (error) => {
        clearTimeout(timer);
        resolve({ kind: "threw", error });
      },
    );
  });
}

const buildRunnerTiming = (
  started: ReturnType<NerveBusRuntimeContext["clock"]["now"]>,
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>,
  handlerCallId: string,
) => ({
  handlerCallId,
  handlerStartedAt: started.iso,
  handlerEndedAt: ended.iso,
  handlerDurationMs: Math.max(0, ended.monotonicMs - started.monotonicMs),
  circuitBreakerState: "closed" as const,
});

const buildHandlerFailureOutcome = <TResult extends SupportedResultEnvelope>(input: {
  handlerDecision: NerveBusRunnerOutcome<TResult> extends infer T
    ? T extends { kind: "handler_failed"; handlerDecision: infer U }
      ? U
      : never
    : never;
  failureReason: string;
  timeoutDecision: "within_timeout" | "timed_out";
  handlerCallId: string;
  started: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
}): NerveBusRunnerOutcome<TResult> => ({
  kind: "handler_failed",
  outputPayload: null,
  handlerDecision: input.handlerDecision,
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  timeoutDecision: input.timeoutDecision,
  ...buildRunnerTiming(input.started, input.ended, input.handlerCallId),
});

const parseHandledEnvelope = <TResult extends SupportedResultEnvelope>(
  resultSchema: TransportResultSchema<TResult>,
  handledEnvelope: unknown,
) => {
  const parsed = resultSchema.safeParse(handledEnvelope);
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : { ok: false as const, failureReason: parsed.error.message };
};

const buildHandledOutcome = <TResult extends SupportedResultEnvelope>(input: {
  handled: NerveBusHandledResult<TResult>;
  resultSchema: TransportResultSchema<TResult>;
  handlerCallId: string;
  started: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
}): NerveBusRunnerOutcome<TResult> => {
  const parsedEnvelope = parseHandledEnvelope(input.resultSchema, input.handled.envelope);
  if (!parsedEnvelope.ok) {
    return buildHandlerFailureOutcome({
      handlerDecision: "invalid_result",
      failureReason: parsedEnvelope.failureReason,
      timeoutDecision: "within_timeout",
      handlerCallId: input.handlerCallId,
      started: input.started,
      ended: input.ended,
    });
  }

  return {
    kind: "handled",
    resultEnvelope: parsedEnvelope.value,
    outputPayload: input.handled.outputPayload,
    handlerDecision: "executed",
    failureReason: input.handled.envelope.failureReason ?? null,
    reviewRequiredReason: input.handled.envelope.reviewRequiredReason ?? null,
    timeoutDecision: "within_timeout",
    ...buildRunnerTiming(input.started, input.ended, input.handlerCallId),
  };
};

const resolveRaceFailure = <TResult extends SupportedResultEnvelope>(input: {
  envelope: SupportedEnvelope;
  controller: AbortController;
  handlerCallId: string;
  started: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
  timeoutMs: number;
  raceResult: TimedRaceResult<NerveBusHandledResult<TResult> | null>;
}): NerveBusRunnerOutcome<TResult> | null => {
  if (input.raceResult.kind === "timed_out") {
    return buildHandlerFailureOutcome({
      handlerDecision: "timed_out",
      failureReason: `Transport timed out after ${input.timeoutMs}ms.`,
      timeoutDecision: "timed_out",
      handlerCallId: input.handlerCallId,
      started: input.started,
      ended: input.ended,
    });
  }

  if (input.raceResult.kind === "threw") {
    return buildHandlerFailureOutcome({
      handlerDecision: input.controller.signal.aborted ? "aborted" : "threw",
      failureReason: input.raceResult.error instanceof Error ? input.raceResult.error.message : "unknown transport runner failure",
      timeoutDecision: input.controller.signal.aborted ? "timed_out" : "within_timeout",
      handlerCallId: input.handlerCallId,
      started: input.started,
      ended: input.ended,
    });
  }

  if (!input.raceResult.value) {
    return buildHandlerFailureOutcome({
      handlerDecision: "missing_handler",
      failureReason: `No handler is registered for ${input.envelope.channelId}.`,
      timeoutDecision: "within_timeout",
      handlerCallId: input.handlerCallId,
      started: input.started,
      ended: input.ended,
    });
  }

  return null;
};

const buildResolvedRaceOutcome = <TResult extends SupportedResultEnvelope>(input: {
  raceResult: TimedRaceResult<NerveBusHandledResult<TResult> | null>;
  envelope: SupportedEnvelope;
  resultSchema: TransportResultSchema<TResult>;
  handlerCallId: string;
  started: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>;
}): NerveBusRunnerOutcome<TResult> => {
  if (input.raceResult.kind !== "resolved" || input.raceResult.value === null) {
    return buildHandlerFailureOutcome({
      handlerDecision: "missing_handler",
      failureReason: `No handler is registered for ${input.envelope.channelId}.`,
      timeoutDecision: "within_timeout",
      handlerCallId: input.handlerCallId,
      started: input.started,
      ended: input.ended,
    });
  }

  return buildHandledOutcome({
    handled: input.raceResult.value,
    resultSchema: input.resultSchema,
    handlerCallId: input.handlerCallId,
    started: input.started,
    ended: input.ended,
  });
};

export async function runTransportHandler<TResult extends SupportedResultEnvelope>(input: {
  envelope: SupportedEnvelope;
  inputPayload: NerveBusPayloadDocument;
  context: NerveBusRuntimeContext;
  timeoutMs: number;
  invoke(signal: AbortSignal): Promise<NerveBusHandledResult<TResult> | null>;
  resultSchema: TransportResultSchema<TResult>;
}): Promise<NerveBusRunnerOutcome<TResult>> {
  const handlerCallId = createId("nerve_bus_handler_call");
  const started = input.context.clock.now();
  const controller = new AbortController();
  const raceResult = await raceWithTimeout({
    promise: input.invoke(controller.signal),
    timeoutMs: input.timeoutMs,
    onTimeout() {
      controller.abort(`Transport timed out after ${input.timeoutMs}ms.`);
    },
  });
  const ended = input.context.clock.now();
  const raceFailure = resolveRaceFailure({
    envelope: input.envelope,
    controller,
    handlerCallId,
    started,
    ended,
    timeoutMs: input.timeoutMs,
    raceResult,
  });
  if (raceFailure) {
    return raceFailure;
  }
  return buildResolvedRaceOutcome({
    raceResult,
    envelope: input.envelope,
    resultSchema: input.resultSchema,
    handlerCallId,
    started,
    ended,
  });
}
