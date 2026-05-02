import { enforceChannelPolicyGate } from "./channel-policy-gate.js";
import { enforceEnvelopeInputGate } from "./envelope-input-gate.js";
import { enforceEnvelopeIntegrityGate } from "./envelope-integrity-gate.js";
import { enforceTransportIdempotencyGate } from "./transport-idempotency-gate.js";
import { nerveBusExecutorFlowSupport } from "./nerve-bus-executor-flow-support.js";
import { nerveBusExecutorSupport } from "./nerve-bus-executor-support.js";
import { enforceTransportResultSemanticGate } from "./transport-result-semantic-gate.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import {
  buildDuplicateInFlightFailureDetails,
  buildHandlerFailureDetails,
  buildQueueRejectedFailureDetails,
  buildSemanticGateFailureDetails,
  buildUnexpectedFailureDetails,
  finalizeExecutionFailure as finalizeFailure,
} from "./transport-failure-details-builders.js";
import type { ExecutionClockSnapshot, ExecutionFailureDetails, NerveBusChildOutcome } from "./transport-failure-types.js";

type ChildInputPayload<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope> = Parameters<NerveBusChildDefinition<TEnvelope, TResult>["execute"]>[0]["inputPayload"];

const resolveInputGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const inputGate = enforceEnvelopeInputGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (inputGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildInputGateFailureDetails<TEnvelope, TResult>(input, started, inputGate);
};

const resolvePolicyGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const policyGate = enforceChannelPolicyGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (policyGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildPolicyGateFailureDetails<TEnvelope, TResult>(input, started, policyGate);
};

const resolveIntegrityGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const integrityGate = enforceEnvelopeIntegrityGate({
    envelope: input.envelope,
    registryEntry: input.registryEntry,
    clock: input.context.clock,
  });
  if (integrityGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildIntegrityGateFailureDetails<TEnvelope, TResult>(input, started, integrityGate);
};

const resolveTimeoutGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const timeoutGate = nerveBusExecutorFlowSupport.resolveTransportTimeoutGate(input.registryEntry.maxDurationMs);
  if (timeoutGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildTimeoutGateFailureDetails<TEnvelope, TResult>(input, started, timeoutGate);
};

const resolveSequenceGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const sequenceGate = nerveBusExecutorFlowSupport.enforceTransportSequencePolicy({
    sequence: input.context.sequence,
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    channelId: input.envelope.channelId,
    sequenceNo: input.envelope.sequenceNo,
  });
  if (sequenceGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildSequenceGateFailureDetails<TEnvelope, TResult>(input, started, sequenceGate);
};

const resolvePreDispatchFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot) => {
  return resolveInputGateFailure(input, started)
    ?? resolvePolicyGateFailure(input, started)
    ?? resolveIntegrityGateFailure(input, started);
};

const resolvePostReservationFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot) => {
  return resolveTimeoutGateFailure(input, started)
    ?? resolveSequenceGateFailure(input, started);
};

const resolveSemanticGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  context: NerveBusRuntimeContext;
}, outcome: Exclude<NerveBusChildOutcome<TEnvelope, TResult>, { kind: "handler_failed" }>) => {
  const semanticGate = enforceTransportResultSemanticGate({
    envelope: input.envelope,
    resultEnvelope: outcome.resultEnvelope,
    outputPayload: outcome.outputPayload,
  });

  return semanticGate.ok ? null : buildSemanticGateFailureDetails(outcome, semanticGate.reason);
};

const buildTransportProof = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  resultEnvelope: TResult;
  outputRef: string | null;
  context: NerveBusRuntimeContext;
  outcome: {
    timeoutDecision: "within_timeout" | "timed_out";
    handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted";
    handlerCallId: string;
    handlerStartedAt: string;
    handlerEndedAt: string;
    handlerDurationMs: number;
    circuitBreakerState: "closed";
    failureReason: string | null;
    reviewRequiredReason: string | null;
  };
}, started: ExecutionClockSnapshot) => nerveBusExecutorSupport.buildSuccessfulExecutionProof(input, started);

const buildSuccessTransportResult = (input: Parameters<typeof nerveBusExecutorSupport.buildSuccessfulTransportResult>[0]) => nerveBusExecutorSupport.buildSuccessfulTransportResult(input);

const completeSuccessfulExecution = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: ChildInputPayload<TEnvelope, TResult>;
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
    outputRef: outputRef.outputRef,
    context: input.context,
    outcome,
  }, started);
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
  inputPayload: ChildInputPayload<TEnvelope, TResult>;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, outcome: NerveBusChildOutcome<TEnvelope, TResult>) => {
  if (outcome.kind === "handler_failed") {
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeFailure(input, started, buildHandlerFailureDetails(outcome));
  }

  const semanticGateFailure = resolveSemanticGateFailure(input, outcome);
  if (semanticGateFailure) {
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeFailure(input, started, semanticGateFailure);
  }

  return completeSuccessfulExecution(input, started, outcome);
};

const runQueuedExecution = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: ChildInputPayload<TEnvelope, TResult>;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot) => {
  const lease = await input.context.queue.tryAcquire();
  if (!lease) {
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeFailure(input, started, buildQueueRejectedFailureDetails(input, started));
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
    return finalizeFailure(input, started, buildUnexpectedFailureDetails(input, started, failedAt, error));
  } finally {
    await lease.release();
  }
};

export async function executeNerveBusChild<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: ChildInputPayload<TEnvelope, TResult>;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}) {
  const started = input.context.clock.now();
  const preDispatchFailure = resolvePreDispatchFailure(input, started);
  if (preDispatchFailure) {
    return finalizeFailure(input, started, preDispatchFailure);
  }

  const idempotencyGate = await enforceTransportIdempotencyGate({
    idempotency: input.context.idempotency,
    idempotencyKey: input.envelope.idempotencyKey,
  });
  if (!idempotencyGate.ok) {
    if (idempotencyGate.idempotencyDecision === "duplicate_skipped") {
      return idempotencyGate.cachedResult;
    }

    return finalizeFailure(
      input,
      started,
      buildDuplicateInFlightFailureDetails(input, started, idempotencyGate.failureReason),
    );
  }

  const postReservationFailure = resolvePostReservationFailure(input, started);
  if (postReservationFailure) {
    await input.context.idempotency.release(input.envelope.idempotencyKey);
    return finalizeFailure(input, started, postReservationFailure);
  }

  await input.context.transport.bindInputPayload({
    inputRef: input.envelope.inputRef,
    payloadRefs: input.envelope.payloadRef,
    payload: input.inputPayload,
  });

  return runQueuedExecution(input, started);
}
