import type { NerveBusClockPort } from "../ports/nerve-bus-clock-port.js";
import type { NerveBusHandlerPort, NerveBusHandledResult } from "../ports/nerve-bus-handler-port.js";
import type { NerveBusIdempotencyPort } from "../ports/nerve-bus-idempotency-port.js";
import type { NerveBusQueuePort } from "../ports/nerve-bus-queue-port.js";
import type { NerveBusTransportPort, NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

export type NerveBusRuntimeContext = {
  clock: NerveBusClockPort;
  handlerPort: NerveBusHandlerPort;
  transport: NerveBusTransportPort;
  idempotency: NerveBusIdempotencyPort;
  queue: NerveBusQueuePort;
};

export type NerveBusRunnerOutcome<TResult extends SupportedResultEnvelope> = {
  resultEnvelope: TResult;
  outputPayload: NerveBusPayloadDocument | null;
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result";
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Transport timed out after ${timeoutMs}ms.`)), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
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
  invoke(): Promise<NerveBusHandledResult<TResult> | null>;
  resultSchema: { parse(data: unknown): TResult };
}): Promise<NerveBusRunnerOutcome<TResult>> {
  try {
    const handled = await withTimeout(input.invoke(), input.timeoutMs);
    if (!handled) {
      return {
        resultEnvelope: null as never,
        outputPayload: null,
        handlerDecision: "missing_handler",
        failureReason: `No handler is registered for ${input.envelope.channelId}.`,
        reviewRequiredReason: null,
      };
    }

    return {
      resultEnvelope: input.resultSchema.parse(handled.envelope),
      outputPayload: handled.outputPayload,
      handlerDecision: "executed",
      failureReason: handled.envelope.failureReason ?? null,
      reviewRequiredReason: handled.envelope.reviewRequiredReason ?? null,
    };
  } catch (error) {
    return {
      resultEnvelope: null as never,
      outputPayload: null,
      handlerDecision: error instanceof Error && error.message.startsWith("Transport timed out")
        ? "missing_handler"
        : "threw",
      failureReason: error instanceof Error ? error.message : "unknown transport runner failure",
      reviewRequiredReason: null,
    };
  }
}
