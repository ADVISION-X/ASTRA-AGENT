import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  continuationController,
  hashField,
  positiveIntegerField,
} from "../../session/continuation-child-input.js";

export const reserveExactGptContinuationOnceHandler:
GptChildHandler<"reserve_exact_gpt_continuation_once"> = async (intent, context) => {
  const reservationKind = stringInput(intent, "reservationKind");
  const derived = reservationKind === "derived_continuation";
  if (reservationKind !== "reusable_origin" && !derived) {
    throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_KIND_INVALID");
  }
  requireExactInputKeys(intent, [
    "authorizationRef", "laneVersion", "originProvenanceHash", "ownerRef",
    "reservationEffectHash", "reservationFenceHash", "reservationIdentityHash",
    "reservationKind", "semanticContractHash", ...(derived ? ["sourceCheckpointHash"] : []), "subjectRef",
  ]);
  const reservationIdentityHash = hashField(
    intent.input.reservationIdentityHash, "GPT_CONTINUATION_RESERVATION_INVALID",
  );
  const readback = continuationController(context).reserve({
    continuation_ref: `gpt-continuation:${reservationIdentityHash.slice(7)}`,
    reservation_kind: reservationKind,
    reservation_identity_hash: reservationIdentityHash,
    creator_job_id: intent.jobId,
    creator_plugin_id: intent.pluginId,
    creator_plugin_version: intent.pluginVersion,
    owner_ref: stringInput(intent, "ownerRef"),
    subject_ref: stringInput(intent, "subjectRef"),
    authorization_ref: stringInput(intent, "authorizationRef"),
    source_checkpoint_hash: derived && "sourceCheckpointHash" in intent.input
      ? hashField(intent.input.sourceCheckpointHash, "GPT_CONTINUATION_RESERVATION_INVALID") : null,
    reservation_fence_hash: hashField(
      intent.input.reservationFenceHash, "GPT_CONTINUATION_RESERVATION_INVALID",
    ),
    reservation_effect_hash: hashField(
      intent.input.reservationEffectHash, "GPT_CONTINUATION_RESERVATION_INVALID",
    ),
    origin_provenance_hash: hashField(
      intent.input.originProvenanceHash, "GPT_CONTINUATION_RESERVATION_INVALID",
    ),
    semantic_contract_hash: hashField(
      intent.input.semanticContractHash, "GPT_CONTINUATION_RESERVATION_INVALID",
    ),
    lane_version: positiveIntegerField(intent.input.laneVersion, "GPT_CONTINUATION_RESERVATION_INVALID"),
  });
  const decision = readback.complete ? "DONE" as const : "ACT" as const;
  return success({
    value: {
      continuationRef: readback.continuation_ref,
      reservationIdentityHash: readback.reservation_identity_hash,
      laneVersion: readback.lane_version,
      reservationFenceHash: readback.reservation_fence_hash,
      complete: readback.complete,
      opaqueReadGrantHash: readback.opaque_read_grant_hash,
    },
    ...declaredFacts({
      decision, factResultIds: [`gpt-transaction:${readback.reservation_identity_hash.slice(7)}`],
      candidateCardinality: { raw: null, eligible: null },
      authorityRefHashes: [readback.reservation_fence_hash], observationRevisionHash: null,
      mutationOutcome: decision === "ACT" ? "confirmed" : "no", browserFact: null, nativeFailureCode: null,
    }),
  });
};
