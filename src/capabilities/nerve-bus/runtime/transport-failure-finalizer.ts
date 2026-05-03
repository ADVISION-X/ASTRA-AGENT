import {
  buildFailurePayloadDocument,
  buildGovernedFailureEnvelope,
  buildGovernedFailureResult,
  buildProofRefForEnvelope,
} from "./transport-result-builder.js";
import { buildTransportProof } from "./transport-proof-builder.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { SupportedEnvelope } from "../shared/nerve-bus-channel.js";

type TransportFailureFinalizerInput = {
  envelope: SupportedEnvelope;
  context: NerveBusRuntimeContext;
  startedAt: string;
  startedMs: number;
  failureReason: string;
  integrityDecision: "valid" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "mismatched_result" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  sequenceDecision: "accepted" | "out_of_order" | "duplicate" | "not_started";
  queueDecision: "acquired" | "queue_rejected" | "not_started";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted" | "not_invoked";
  policyDecision: "allowed" | "forbidden_route";
  status: "failed" | "review_required";
  reviewRequiredReason?: string | null;
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
  handlerCallId: string;
  handlerStartedAt: string;
  handlerEndedAt: string;
  handlerDurationMs: number;
  circuitBreakerState: "closed";
};

const buildFailureProof = (input: TransportFailureFinalizerInput, ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>, resultEnvelope: ReturnType<typeof buildGovernedFailureEnvelope>, diagnosticPayloadRef: string) =>
  buildTransportProof({
    envelope: input.envelope,
    resultEnvelope,
    startedAt: input.startedAt,
    endedAt: ended.iso,
    durationMs: ended.monotonicMs - input.startedMs,
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    idempotencyDecision: input.idempotencyDecision,
    sequenceDecision: input.sequenceDecision,
    queueDecision: input.queueDecision,
    timeoutDecision: input.timeoutDecision,
    handlerDecision: input.handlerDecision,
    handlerCallId: input.handlerCallId,
    handlerStartedAt: input.handlerStartedAt,
    handlerEndedAt: input.handlerEndedAt,
    handlerDurationMs: input.handlerDurationMs,
    circuitBreakerState: input.circuitBreakerState,
    outputRef: null,
    diagnosticPayloadRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    semanticDecision: input.integrityDecision === "mismatched_result" ? "failed" : "not_started",
    dataQualityFlags: ["transport_governed_failure"],
  });

const buildFailureResultEnvelope = (
  input: TransportFailureFinalizerInput,
  ended: ReturnType<NerveBusRuntimeContext["clock"]["now"]>,
  diagnosticPayloadRef: Awaited<ReturnType<NerveBusRuntimeContext["transport"]["writeOutputPayload"]>>,
) => buildGovernedFailureEnvelope({
  envelope: input.envelope,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  status: input.status,
  proofRef: buildProofRefForEnvelope(input.envelope),
  createdAt: ended.iso,
  diagnosticPayloadRef,
});

const commitFailureResult = async (
  input: TransportFailureFinalizerInput,
  transportResult: Awaited<ReturnType<typeof buildGovernedFailureResult>>,
): Promise<void> => {
  if (input.idempotencyDecision === "executed") {
    await input.context.idempotency.commit(input.envelope.idempotencyKey, transportResult);
  }
};

export const finalizeFailure = async (input: TransportFailureFinalizerInput) => {
  const ended = input.context.clock.now();
  const payload = buildFailurePayloadDocument({ envelope: input.envelope, failureReason: input.failureReason });
  const diagnosticPayloadRef = await input.context.transport.writeOutputPayload({
    channelId: input.envelope.channelId,
    resultRef: input.envelope.envelopeId,
    payload,
  });
  const resultEnvelope = buildFailureResultEnvelope(input, ended, diagnosticPayloadRef);
  const proof = buildFailureProof(input, ended, resultEnvelope, diagnosticPayloadRef.outputRef);
  const transportResult = await buildGovernedFailureResult({
    envelope: input.envelope,
    resultEnvelope,
    proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    transportDecision: input.transportDecision ?? "executed",
  });

  await commitFailureResult(input, transportResult);
  return transportResult;
};
