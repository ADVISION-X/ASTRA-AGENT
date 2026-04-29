import { createId } from "../../../lib/local-runtime/ids.js";

import { NerveBusTransportProofSchema } from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";

export function buildTransportProof(input: {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  policyDecision: "allowed" | "forbidden_route";
  integrityDecision: "valid" | "invalid_schema" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "mismatched_result" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "not_invoked";
  outputRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): NerveBusTransportProof {
  return NerveBusTransportProofSchema.parse({
    proofId: createId("nerve_bus_proof"),
    transportId: input.envelope.transportId,
    traceId: input.envelope.traceId,
    spanId: input.envelope.spanId,
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    stepId: input.envelope.stepId,
    channelId: input.envelope.channelId,
    from: input.envelope.from,
    to: input.envelope.to,
    envelopeId: input.envelope.envelopeId,
    idempotencyKey: input.envelope.idempotencyKey,
    sequenceNo: input.envelope.sequenceNo,
    payloadRef: input.envelope.payloadRef,
    inputRef: input.envelope.inputRef,
    outputRef: input.outputRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Math.trunc(input.durationMs)),
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    idempotencyDecision: input.idempotencyDecision,
    timeoutDecision: input.timeoutDecision,
    handlerDecision: input.handlerDecision,
    dataQualityFlags: input.dataQualityFlags,
  });
}
