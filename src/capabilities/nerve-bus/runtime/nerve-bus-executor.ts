import { buildFailurePayloadDocument, buildGovernedFailureResult } from "./transport-result-builder.js";
import { buildTransportProof } from "./transport-proof-builder.js";
import { enforceChannelPolicyGate } from "./channel-policy-gate.js";
import { enforceEnvelopeInputGate } from "./envelope-input-gate.js";
import { enforceEnvelopeIntegrityGate } from "./envelope-integrity-gate.js";
import { enforceTransportIdempotencyGate } from "./transport-idempotency-gate.js";
import { resolveTransportTimeoutGate } from "./transport-timeout-gate.js";
import { enforceTransportSequencePolicy } from "./transport-sequence-policy.js";
import {
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
} from "../schema.js";
import type { NerveBusRuntimeContext } from "./transport-runner.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";

export async function executeNerveBusChild<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  inputPayload: import("../ports/nerve-bus-transport-port.js").NerveBusPayloadDocument;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}) {
  const started = input.context.clock.now();
  await input.context.transport.bindInputPayload({
    inputRef: input.envelope.inputRef,
    payloadRefs: input.envelope.payloadRef,
    payload: input.inputPayload,
  });

  const inputGate = enforceEnvelopeInputGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (!inputGate.ok) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: inputGate.reason,
      integrityDecision: inputGate.integrityDecision,
      idempotencyDecision: "replay_rejected",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "allowed",
      status: "failed",
    });
  }

  const policyGate = enforceChannelPolicyGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (!policyGate.ok) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: policyGate.reason,
      integrityDecision: "valid",
      idempotencyDecision: "replay_rejected",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "forbidden_route",
      status: "failed",
    });
  }

  const integrityGate = enforceEnvelopeIntegrityGate({
    envelope: input.envelope,
    registryEntry: input.registryEntry,
    clock: input.context.clock,
  });
  if (!integrityGate.ok) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: integrityGate.reason,
      integrityDecision: integrityGate.integrityDecision,
      idempotencyDecision: "replay_rejected",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "allowed",
      status: "failed",
    });
  }

  const idempotencyGate = await enforceTransportIdempotencyGate({
    idempotency: input.context.idempotency,
    idempotencyKey: input.envelope.idempotencyKey,
  });
  if (!idempotencyGate.ok && idempotencyGate.cachedResult) {
    return idempotencyGate.cachedResult;
  }

  const timeoutGate = resolveTransportTimeoutGate(input.registryEntry.maxDurationMs);
  if (!timeoutGate.ok) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: timeoutGate.reason,
      integrityDecision: "valid",
      idempotencyDecision: "executed",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "allowed",
      status: "failed",
    });
  }

  const sequenceGate = enforceTransportSequencePolicy({
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    stepId: input.envelope.stepId,
    channelId: input.envelope.channelId,
    sequenceNo: input.envelope.sequenceNo,
  });
  if (!sequenceGate.ok) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: sequenceGate.reason,
      integrityDecision: sequenceGate.integrityDecision,
      idempotencyDecision: "executed",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "allowed",
      status: "failed",
    });
  }

  const lease = await input.context.queue.tryAcquire();
  if (!lease) {
    return finalizeFailure({
      envelope: input.envelope,
      context: input.context,
      startedAt: started.iso,
      startedMs: started.monotonicMs,
      failureReason: "Transport queue is saturated.",
      integrityDecision: "valid",
      idempotencyDecision: "executed",
      timeoutDecision: "not_started",
      handlerDecision: "not_invoked",
      policyDecision: "allowed",
      status: "review_required",
      reviewRequiredReason: "Transport queue rejected the envelope due to backpressure.",
      transportDecision: "queue_rejected",
    });
  }

  try {
    const outcome = await input.child.execute({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      registryEntry: input.registryEntry,
      context: input.context,
    });
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
      timeoutDecision: "within_timeout",
      handlerDecision: outcome.handlerDecision,
      outputRef: outputRef.outputRef,
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
  } finally {
    await lease.release();
  }
}

async function finalizeFailure(input: {
  envelope: SupportedEnvelope;
  context: NerveBusRuntimeContext;
  startedAt: string;
  startedMs: number;
  failureReason: string;
  integrityDecision: "valid" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "not_invoked";
  policyDecision: "allowed" | "forbidden_route";
  status: "failed" | "review_required";
  reviewRequiredReason?: string | null;
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
}) {
  const ended = input.context.clock.now();
  const payload = buildFailurePayloadDocument({ envelope: input.envelope, failureReason: input.failureReason });
  const outputPayloadRef = await input.context.transport.writeOutputPayload({
    channelId: input.envelope.channelId,
    resultRef: input.envelope.envelopeId,
    payload,
  });
  const proof = buildTransportProof({
    envelope: input.envelope,
    resultEnvelope: {
      ...input.envelope,
      envelopeKind: input.envelope.envelopeKind,
      status: input.status,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason ?? null,
      outputRef: outputPayloadRef.outputRef,
    } as never,
    startedAt: input.startedAt,
    endedAt: ended.iso,
    durationMs: ended.monotonicMs - input.startedMs,
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    idempotencyDecision: input.idempotencyDecision,
    timeoutDecision: input.timeoutDecision,
    handlerDecision: input.handlerDecision,
    outputRef: outputPayloadRef.outputRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: ["transport_governed_failure"],
  });
  const transportResult = await buildGovernedFailureResult({
    envelope: input.envelope,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    status: input.status,
    proof,
    outputPayloadRef,
  });
  if (input.idempotencyDecision === "executed") {
    await input.context.idempotency.commit(input.envelope.idempotencyKey, transportResult);
  }
  return transportResult;
}

function buildSuccessTransportResult(input: {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  proof: import("../shared/nerve-bus-proof.js").NerveBusTransportProof;
}) {
  if (input.envelope.envelopeKind === "ability_command") {
    return AbilityTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status: input.resultEnvelope.status,
      transportDecision: "executed",
      commandEnvelope: input.envelope,
      resultEnvelope: input.resultEnvelope,
      proof: input.proof,
      failureReason: input.resultEnvelope.failureReason,
      reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
    });
  }

  if (input.envelope.envelopeKind === "ai_request") {
    return AiTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status: input.resultEnvelope.status,
      transportDecision: "executed",
      requestEnvelope: input.envelope,
      responseEnvelope: input.resultEnvelope,
      proof: input.proof,
      failureReason: input.resultEnvelope.failureReason,
      reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
    });
  }

  return HumanCommandTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: input.resultEnvelope.status,
    transportDecision: "executed",
    commandEnvelope: input.envelope,
    resultEnvelope: input.resultEnvelope,
    proof: input.proof,
    failureReason: input.resultEnvelope.failureReason,
    reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
  });
}
