import { enforceChannelPolicyGate } from "./channel-policy-gate.js";
import { enforceEnvelopeInputGate } from "./envelope-input-gate.js";
import { enforceEnvelopeIntegrityGate } from "./envelope-integrity-gate.js";
import { enforceTransportIdempotencyGate } from "./transport-idempotency-gate.js";
import { nerveBusExecutorFlowSupport } from "./nerve-bus-executor-flow-support.js";
import { nerveBusExecutorSupport } from "./nerve-bus-executor-support.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import {
  buildHandlerFailureDetails,
  buildQueueRejectedFailureDetails,
  buildUnexpectedFailureDetails,
  type ExecutionClockSnapshot,
  type ExecutionFailureDetails,
  type NerveBusChildOutcome,
} from "./transport-failure-details-builders.js";

const buildFailureResultCheckpoint = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, details: ExecutionFailureDetails) => {
  const proof = nerveBusExecutorSupport.buildFailureCheckpointProof<TEnvelope, TResult>(input, started, details);

  return buildGovernedFailureResult({
    envelope: input.envelope,
    failureReason: details.failureReason,
    reviewRequiredReason: details.reviewRequiredReason,
    status: details.status,
    proof,
    diagnosticPayloadRef: nerveBusExecutorSupport.createFailureCheckpointDiagnosticPayloadRef(input.envelope),
    transportDecision: details.transportDecision ?? "executed",
  });
};

const buildGovernedFailureResult = (input: Parameters<typeof nerveBusExecutorFlowSupport.buildGovernedFailureResult>[0]) => nerveBusExecutorFlowSupport.buildGovernedFailureResult(input);

const finalizeFailure = (input: Parameters<typeof nerveBusExecutorFlowSupport.finalizeFailure>[0]) => nerveBusExecutorFlowSupport.finalizeFailure(input);

const finalizeExecutionFailure = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, details: ExecutionFailureDetails) => {
  buildFailureResultCheckpoint<TEnvelope, TResult>(input, started, details);
  return finalizeFailure({
    envelope: input.envelope,
    context: input.context,
    startedAt: started.iso,
    startedMs: started.monotonicMs,
    failureReason: details.failureReason,
    integrityDecision: details.integrityDecision,
    idempotencyDecision: details.idempotencyDecision,
    sequenceDecision: details.sequenceDecision,
    queueDecision: details.queueDecision,
    timeoutDecision: details.timeoutDecision,
    handlerDecision: details.handlerDecision,
    policyDecision: details.policyDecision,
    status: details.status,
    reviewRequiredReason: details.reviewRequiredReason,
    handlerCallId: details.handlerCallId,
    handlerStartedAt: details.handlerStartedAt,
    handlerEndedAt: details.handlerEndedAt,
    handlerDurationMs: details.handlerDurationMs,
    circuitBreakerState: "closed",
    ...(details.transportDecision ? { transportDecision: details.transportDecision } : {}),
  });
};

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

const resolveTransportTimeoutGate = (maxDurationMs: Parameters<typeof nerveBusExecutorFlowSupport.resolveTransportTimeoutGate>[0]) => nerveBusExecutorFlowSupport.resolveTransportTimeoutGate(maxDurationMs);

const resolveTimeoutGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const timeoutGate = resolveTransportTimeoutGate(input.registryEntry.maxDurationMs);
  if (timeoutGate.ok) {
    return null;
  }

  return nerveBusExecutorSupport.buildTimeoutGateFailureDetails<TEnvelope, TResult>(input, started, timeoutGate);
};

const enforceTransportSequencePolicy = (input: Parameters<typeof nerveBusExecutorFlowSupport.enforceTransportSequencePolicy>[0]) => nerveBusExecutorFlowSupport.enforceTransportSequencePolicy(input);

const resolveSequenceGateFailure = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot): ExecutionFailureDetails | null => {
  const sequenceGate = enforceTransportSequencePolicy({
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    stepId: input.envelope.stepId,
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
}, started: ExecutionClockSnapshot) => {
  return resolveTimeoutGateFailure(input, started)
    ?? resolveSequenceGateFailure(input, started);
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

  const preDispatchFailure = resolvePreDispatchFailure(input, started);
  if (preDispatchFailure) {
    return finalizeExecutionFailure(input, started, preDispatchFailure);
  }

  const idempotencyGate = await enforceTransportIdempotencyGate({
    idempotency: input.context.idempotency,
    idempotencyKey: input.envelope.idempotencyKey,
  });
  if (!idempotencyGate.ok && idempotencyGate.cachedResult) {
    return idempotencyGate.cachedResult;
  }

  const postReservationFailure = resolvePostReservationFailure(input, started);
  if (postReservationFailure) {
    return finalizeExecutionFailure(input, started, postReservationFailure);
  }

  return runQueuedExecution(input, started);
}
