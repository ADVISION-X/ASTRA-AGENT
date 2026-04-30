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

async function raceWithTimeout<T>(input: {
  promise: Promise<T>;
  timeoutMs: number;
  onTimeout(): void;
}): Promise<{ kind: "resolved"; value: T } | { kind: "timed_out" }> {
  return new Promise((resolve, reject) => {
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
        reject(error);
      },
    );
  });
}

export async function runTransportHandler<TResult extends SupportedResultEnvelope>(input: {
  envelope: SupportedEnvelope;
  inputPayload: NerveBusPayloadDocument;
  context: NerveBusRuntimeContext;
  timeoutMs: number;
  invoke(signal: AbortSignal): Promise<NerveBusHandledResult<TResult> | null>;
  resultSchema: { parse(data: unknown): TResult };
}): Promise<NerveBusRunnerOutcome<TResult>> {
  const handlerCallId = createId("nerve_bus_handler_call");
  const started = input.context.clock.now();
  const controller = new AbortController();
  try {
    const raceResult = await raceWithTimeout({
      promise: input.invoke(controller.signal),
      timeoutMs: input.timeoutMs,
      onTimeout() {
        controller.abort(`Transport timed out after ${input.timeoutMs}ms.`);
      },
    });
    const ended = input.context.clock.now();
    const handlerDurationMs = Math.max(0, ended.monotonicMs - started.monotonicMs);

    if (raceResult.kind === "timed_out") {
      return {
        kind: "handler_failed",
        outputPayload: null,
        handlerDecision: "timed_out",
        failureReason: `Transport timed out after ${input.timeoutMs}ms.`,
        reviewRequiredReason: null,
        timeoutDecision: "timed_out",
        handlerCallId,
        handlerStartedAt: started.iso,
        handlerEndedAt: ended.iso,
        handlerDurationMs,
        circuitBreakerState: "closed",
      };
    }

    const handled = raceResult.value;
    if (!handled) {
      return {
        kind: "handler_failed",
        outputPayload: null,
        handlerDecision: "missing_handler",
        failureReason: `No handler is registered for ${input.envelope.channelId}.`,
        reviewRequiredReason: null,
        timeoutDecision: "within_timeout",
        handlerCallId,
        handlerStartedAt: started.iso,
        handlerEndedAt: ended.iso,
        handlerDurationMs,
        circuitBreakerState: "closed",
      };
    }

    try {
      return {
        kind: "handled",
        resultEnvelope: input.resultSchema.parse(handled.envelope),
        outputPayload: handled.outputPayload,
        handlerDecision: "executed",
        failureReason: handled.envelope.failureReason ?? null,
        reviewRequiredReason: handled.envelope.reviewRequiredReason ?? null,
        timeoutDecision: "within_timeout",
        handlerCallId,
        handlerStartedAt: started.iso,
        handlerEndedAt: ended.iso,
        handlerDurationMs,
        circuitBreakerState: "closed",
      };
    } catch (error) {
      return {
        kind: "handler_failed",
        outputPayload: null,
        handlerDecision: "invalid_result",
        failureReason: error instanceof Error ? error.message : "invalid transport handler result",
        reviewRequiredReason: null,
        timeoutDecision: "within_timeout",
        handlerCallId,
        handlerStartedAt: started.iso,
        handlerEndedAt: ended.iso,
        handlerDurationMs,
        circuitBreakerState: "closed",
      };
    }
  } catch (error) {
    const ended = input.context.clock.now();
    return {
      kind: "handler_failed",
      outputPayload: null,
      handlerDecision: controller.signal.aborted ? "aborted" : "threw",
      failureReason: error instanceof Error ? error.message : "unknown transport runner failure",
      reviewRequiredReason: null,
      timeoutDecision: controller.signal.aborted ? "timed_out" : "within_timeout",
      handlerCallId,
      handlerStartedAt: started.iso,
      handlerEndedAt: ended.iso,
      handlerDurationMs: Math.max(0, ended.monotonicMs - started.monotonicMs),
      circuitBreakerState: "closed",
    };
  }
}
