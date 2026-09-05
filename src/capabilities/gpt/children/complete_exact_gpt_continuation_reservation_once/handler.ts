import { executionFailure } from "../../../../lib/execution-failure.js";

import { gptContinuationReservationComplete } from "../../session/gpt-continuation-store-port.js";
import {
  continuationController,
  continuationStore,
  exactRecordKeys,
  hashField,
  positiveIntegerField,
  providerFrom,
  textCheckpointFromRecord,
  textField,
} from "../../session/continuation-child-input.js";
import {
  declaredFacts,
  recordInput,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";

export const completeExactGptContinuationReservationOnceHandler:
GptChildHandler<"complete_exact_gpt_continuation_reservation_once"> = async (intent, context) => {
  requireExactInputKeys(intent, [
    "artifactHash", "artifactRef", "checkpoint", "completionReceiptHash", "laneVersion",
    "opaqueReadGrantHash", "provider", "reservationFenceHash", "reservationIdentityHash",
    "semanticAdmissionReceipt", "semanticAdmissionReceiptHash", "semanticAdmissionReceiptRef",
  ]);
  const reservationIdentityHash = hashField(
    intent.input.reservationIdentityHash, "GPT_CONTINUATION_COMPLETION_INVALID",
  );
  const semanticReceipt = recordInput(intent, "semanticAdmissionReceipt");
  exactRecordKeys(semanticReceipt, [
    "artifact_hash", "artifact_ref", "contract_evaluation_hash", "contract_hash", "outcome", "schema_version",
  ], "GPT_CONTINUATION_COMPLETION_INVALID");
  const continuationRef = `gpt-continuation:${reservationIdentityHash.slice(7)}`;
  const existing = continuationStore(context).readGptContinuation(continuationRef);
  const decision = existing && gptContinuationReservationComplete(existing) ? "DONE" as const : "ACT" as const;
  const stored = continuationController(context).complete({
    continuation_ref: continuationRef,
    reservation_identity_hash: reservationIdentityHash,
    creator_job_id: intent.jobId,
    lane_version: positiveIntegerField(intent.input.laneVersion, "GPT_CONTINUATION_COMPLETION_INVALID"),
    reservation_fence_hash: hashField(
      intent.input.reservationFenceHash, "GPT_CONTINUATION_COMPLETION_INVALID",
    ),
    provider: providerFrom(intent),
    checkpoint: textCheckpointFromRecord(
      recordInput(intent, "checkpoint"), "GPT_CONTINUATION_COMPLETION_INVALID",
    ),
    artifact_ref: stringInput(intent, "artifactRef"),
    artifact_hash: hashField(intent.input.artifactHash, "GPT_CONTINUATION_COMPLETION_INVALID"),
    semantic_admission_receipt_ref: stringInput(intent, "semanticAdmissionReceiptRef"),
    semantic_admission_receipt_hash: hashField(
      intent.input.semanticAdmissionReceiptHash, "GPT_CONTINUATION_COMPLETION_INVALID",
    ),
    semantic_admission_receipt: Object.freeze({
      schema_version: semanticReceipt.schema_version === "exact-semantic-admission-receipt.v1"
        ? semanticReceipt.schema_version : (() => { throw executionFailure("failed", "GPT_CONTINUATION_COMPLETION_INVALID"); })(),
      artifact_ref: textField(semanticReceipt.artifact_ref, "GPT_CONTINUATION_COMPLETION_INVALID"),
      artifact_hash: hashField(semanticReceipt.artifact_hash, "GPT_CONTINUATION_COMPLETION_INVALID"),
      contract_hash: hashField(semanticReceipt.contract_hash, "GPT_CONTINUATION_COMPLETION_INVALID"),
      contract_evaluation_hash: hashField(
        semanticReceipt.contract_evaluation_hash, "GPT_CONTINUATION_COMPLETION_INVALID",
      ),
      outcome: semanticReceipt.outcome === "accepted"
        ? semanticReceipt.outcome : (() => { throw executionFailure("failed", "GPT_CONTINUATION_COMPLETION_INVALID"); })(),
    }),
    opaque_read_grant_hash: hashField(intent.input.opaqueReadGrantHash, "GPT_CONTINUATION_COMPLETION_INVALID"),
    completion_receipt_hash: hashField(
      intent.input.completionReceiptHash, "GPT_CONTINUATION_COMPLETION_INVALID",
    ),
  });
  if (!stored.completion_receipt_hash) {
    throw executionFailure("failed", "GPT_CONTINUATION_COMPLETION_READBACK_MISSING");
  }
  return success({
    value: {
      continuationRef: stored.continuation_ref,
      reservationIdentityHash: stored.reservation_identity_hash,
      laneVersion: stored.lane_version,
      completionReceiptHash: stored.completion_receipt_hash,
    },
    ...declaredFacts({
      decision, factResultIds: [`gpt-transaction:${stored.completion_receipt_hash.slice(7)}`],
      candidateCardinality: { raw: null, eligible: null },
      authorityRefHashes: [stored.completion_receipt_hash], observationRevisionHash: null,
      mutationOutcome: decision === "ACT" ? "confirmed" : "no", browserFact: null, nativeFailureCode: null,
    }),
  });
};
