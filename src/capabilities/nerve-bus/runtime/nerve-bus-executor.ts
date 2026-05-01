import { buildTransportProof } from "./transport-proof-builder.js";
import { enforceTransportIdempotencyGate } from "./transport-idempotency-gate.js";
import { buildSuccessTransportResult } from "./transport-success-result.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import {
  buildHandlerFailureDetails,
  buildQueueRejectedFailureDetails,
  buildUnexpectedFailureDetails,
  finalizeExecutionFailure,
  type ExecutionClockSnapshot,
  type ExecutionFailureDetails,
  type NerveBusChildOutcome,
} from "./transport-failure-details-builders.js";
import { runInitialValidationGates, runPostIdempotencyValidationGates } from "./transport-validation-orchestrator.js";

const completeSuccessfulExecution = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: NerveBusPayloadDocument;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, outcome: Exclude<NerveBusChildOutcome<TEnvelope, TResult>, { kind: "handler_failed" }>) => {
  const ended = input.context.clock.now();
  const outputRef = outcome.outputPayload
    ? await input.context.transport.writeOutputPayload({
      channelId: input.envelope.channelId,
      resultRef: "resultId" in outcome.resultEnvelope ? outcome.resultEnvelope.resultId : outcome.resultEnvelope.responseId,
      payload: outcome.outputPayload,
    })
    : { outputRef: null, payloadRefs: outcome.resultEnvelope.payloadRef };
  const proof = buildTransportProof({
    envelope: input.envelope,
    resultEnvelope: outcome.resultEnvelope,
    startedAt: started.iso,
    endedAt: ended.iso,
    durationMs: ended.monotonicMs - started.monotonicMs,
    policyDecision: "allowed",
    integrityDecision: "valid",
    idempotencyDecision: "executed",
    sequenceDecision: "accepted",
    queueDecision: "acquired",
    timeoutDecision: outcome.timeoutDecision,
    handlerDecision: outcome.handlerDecision,
    handlerCallId: outcome.handlerCallId,
    handlerStartedAt: outcome.handlerStartedAt,
    handlerEndedAt: outcome.handlerEndedAt,
    handlerDurationMs: outcome.handlerDurationMs,
    circuitBreakerState: outcome.circuitBreakerState,
    outputRef: outputRef.outputRef,
    diagnosticPayloadRef: outcome.resultEnvelope.diagnosticPayloadRef,
    status: outcome.resultEnvelope.status,
    failureReason: outcome.failureReason,
    reviewRequiredReason: outcome.reviewRequiredReason,
    dataQualityFlags: outcome.handlerDecision === "executed" ? [] : ["transport_handler_degraded"],
  });
  const transportResult = buildSuccessTransportResult({
    envelope: input.envelope,
    resultEnvelope: outcome.resultEnvelope,
    proof,
  });
  await input.context.idempotency.commit(input.envelope.idempotencyKey, transportResult);
  return transportResult;
};

const finalizeExecutionOutcome = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: NerveBusPayloadDocument;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, outcome: NerveBusChildOutcome<TEnvelope, TResult>) => {
  if (outcome.kind === "handler_failed") {
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeExecutionFailure(input, started, buildHandlerFailureDetails(outcome));
  }

  return completeSuccessfulExecution(input, started, outcome);
};

const runQueuedExecution = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: NerveBusPayloadDocument;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot) => {
  const lease = await input.context.queue.tryAcquire();
  if (!lease) {
    return finalizeExecutionFailure(input, started, buildQueueRejectedFailureDetails(input, started));
  }

  try {
    const outcome = await input.child.execute({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      registryEntry: input.registryEntry,
      context: input.context,
    });
    return finalizeExecutionOutcome(input, started, outcome);
  } catch (error) {
    const failedAt = input.context.clock.now();
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeExecutionFailure(input, started, buildUnexpectedFailureDetails(input, started, failedAt, error));
  } finally {
    await lease.release();
  }
};

export async function executeNerveBusChild<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: NerveBusPayloadDocument;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}) {
  const started = input.context.clock.now();
  await input.context.transport.bindInputPayload({
    inputRef: input.envelope.inputRef,
    payloadRefs: input.envelope.payloadRef,
    payload: input.inputPayload,
  });

  const validationFailure = await runInitialValidationGates(input, started);
  if (validationFailure) {
    return finalizeExecutionFailure(input, started, validationFailure);
  }

  const idempotencyGate = await enforceTransportIdempotencyGate({
    idempotency: input.context.idempotency,
    idempotencyKey: input.envelope.idempotencyKey,
  });
  if (!idempotencyGate.ok && idempotencyGate.cachedResult) {
    return idempotencyGate.cachedResult;
  }

  const postIdempotencyFailure = await runPostIdempotencyValidationGates(input, started);
  if (postIdempotencyFailure) {
    return finalizeExecutionFailure(input, started, postIdempotencyFailure);
  }

    return runQueuedExecution(input, started);
}
