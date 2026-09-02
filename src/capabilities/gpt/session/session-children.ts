import { gptExactCallIdentityHash, type GptChildCapabilityIntent } from "../contract.js";
import { executionFailure } from "../../../lib/typed-failure.js";
import type { GptChildHandlerMap } from "../web/child-handler.js";
import {
  recordInput,
  requireExactInputKeys,
  stringInput,
  success,
} from "../web/child-handler.js";
import { GptSessionController, type GptContinuationLane } from "./gpt-session-controller.js";
import type {
  GptContinuationCheckpoint,
  GptContinuationFrontierBinding,
  GptContinuationTextCheckpoint,
  GptProviderContinuation,
} from "./gpt-continuation-store-port.js";

const controller = (context: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[1]) => {
  if (!context.continuationStore) throw executionFailure("failed", "GPT_CONTINUATION_STORE_REQUIRED");
  return new GptSessionController(context.continuationStore);
};

const providerFrom = (
  intent: GptChildCapabilityIntent,
  key = "provider",
): GptProviderContinuation => {
  const value = recordInput(intent, key);
  if (typeof value.provider_page_url !== "string"
    || typeof value.prior_task_id !== "string"
    || typeof value.prior_prompt_hash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(value.prior_prompt_hash)
    || typeof value.prior_raw_output_hash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(value.prior_raw_output_hash)
    || typeof value.prior_turn_marker !== "string") {
    throw executionFailure("failed", "GPT_CONTINUATION_PROVIDER_INVALID");
  }
  return {
    provider_page_url: value.provider_page_url,
    prior_task_id: value.prior_task_id,
    prior_prompt_hash: value.prior_prompt_hash as `sha256:${string}`,
    prior_raw_output_hash: value.prior_raw_output_hash as `sha256:${string}`,
    prior_turn_marker: value.prior_turn_marker,
  };
};

const laneFrom = (intent: GptChildCapabilityIntent): GptContinuationLane => {
  const value = recordInput(intent, "lane");
  if (typeof value.continuation_ref !== "string"
    || typeof value.lane_version !== "number" || !Number.isSafeInteger(value.lane_version)
    || !value.provider || typeof value.provider !== "object" || Array.isArray(value.provider)) {
    throw executionFailure("failed", "GPT_CONTINUATION_LANE_INVALID");
  }
  return {
    continuation_ref: value.continuation_ref,
    lane_version: value.lane_version,
    provider: providerFrom({ ...intent, input: { provider: value.provider } }),
  };
};

const exactRecordKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  code: string,
): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw executionFailure("failed", code);
  }
};

const hashField = (value: unknown, code: string): `sha256:${string}` => {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw executionFailure("failed", code);
  }
  return value as `sha256:${string}`;
};

const textField = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value) throw executionFailure("failed", code);
  return value;
};

const positiveIntegerField = (value: unknown, code: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw executionFailure("failed", code);
  }
  return value;
};

const textCheckpointFromRecord = (
  checkpoint: Readonly<Record<string, unknown>>,
  code: string,
): GptContinuationTextCheckpoint => {
  exactRecordKeys(checkpoint, [
    "artifactRef", "assistantTurnId", "canonicalConversationUrl", "checkpointKind",
    "evidenceHash", "evidenceRef", "promptHash", "rawDomHash", "semanticTextHash",
    "sourceAttemptId", "turnMarker",
  ], code);
  if (checkpoint.checkpointKind !== "text") throw executionFailure("failed", code);
  return Object.freeze({
    checkpoint_kind: "text",
    source_attempt_id: textField(checkpoint.sourceAttemptId, code),
    assistant_turn_id: textField(checkpoint.assistantTurnId, code),
    artifact_ref: textField(checkpoint.artifactRef, code),
    raw_dom_hash: hashField(checkpoint.rawDomHash, code),
    semantic_text_hash: hashField(checkpoint.semanticTextHash, code),
    canonical_conversation_url: textField(checkpoint.canonicalConversationUrl, code),
    prompt_hash: hashField(checkpoint.promptHash, code),
    turn_marker: textField(checkpoint.turnMarker, code),
    evidence_ref: textField(checkpoint.evidenceRef, code),
    evidence_hash: hashField(checkpoint.evidenceHash, code),
  });
};

const checkpointFrom = (
  intent: GptChildCapabilityIntent,
  key = "currentCheckpoint",
): GptContinuationCheckpoint => {
  const checkpoint = recordInput(intent, key);
  if (checkpoint.checkpointKind === "text") {
    return textCheckpointFromRecord(checkpoint, "GPT_CONTINUATION_CHECKPOINT_INVALID");
  }
  exactRecordKeys(checkpoint, [
    "assistantTurnId", "canonicalConversationUrl", "checkpointKind", "evidenceHash", "evidenceRef",
    "height", "mediaHash", "mediaType", "originalArtifactRef", "originalBytes", "originalHeight",
    "originalMediaType", "originalSha256", "originalWidth", "predecessorTextCheckpoint", "promptHash",
    "sourceAttemptId", "turnMarker", "webpArtifactRef", "webpBytes", "webpSha256", "width",
  ], "GPT_CONTINUATION_CHECKPOINT_INVALID");
  const predecessor = checkpoint.predecessorTextCheckpoint;
  if (checkpoint.checkpointKind !== "generated_image"
    || !predecessor || typeof predecessor !== "object" || Array.isArray(predecessor)
    || checkpoint.mediaType !== "image/webp" || checkpoint.width !== 1200 || checkpoint.height !== 630
    || typeof checkpoint.originalMediaType !== "string"
    || !/^image\/[a-z0-9.+-]+$/u.test(checkpoint.originalMediaType)) {
    throw executionFailure("failed", "GPT_CONTINUATION_CHECKPOINT_INVALID");
  }
  return Object.freeze({
    checkpoint_kind: "generated_image",
    source_attempt_id: textField(checkpoint.sourceAttemptId, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    assistant_turn_id: textField(checkpoint.assistantTurnId, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    canonical_conversation_url: textField(checkpoint.canonicalConversationUrl, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    prompt_hash: hashField(checkpoint.promptHash, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    media_hash: hashField(checkpoint.mediaHash, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    turn_marker: textField(checkpoint.turnMarker, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    original_artifact_ref: textField(checkpoint.originalArtifactRef, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    original_sha256: hashField(checkpoint.originalSha256, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    original_bytes: positiveIntegerField(checkpoint.originalBytes, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    original_media_type: checkpoint.originalMediaType as `image/${string}`,
    original_width: positiveIntegerField(checkpoint.originalWidth, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    original_height: positiveIntegerField(checkpoint.originalHeight, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    webp_artifact_ref: textField(checkpoint.webpArtifactRef, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    webp_sha256: hashField(checkpoint.webpSha256, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    webp_bytes: positiveIntegerField(checkpoint.webpBytes, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    media_type: "image/webp", width: 1200, height: 630,
    evidence_ref: textField(checkpoint.evidenceRef, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    evidence_hash: hashField(checkpoint.evidenceHash, "GPT_CONTINUATION_CHECKPOINT_INVALID"),
    predecessor_text_checkpoint: textCheckpointFromRecord(
      predecessor as Readonly<Record<string, unknown>>, "GPT_CONTINUATION_CHECKPOINT_INVALID",
    ),
  });
};

const frontierFrom = (intent: GptChildCapabilityIntent): GptContinuationFrontierBinding => {
  const frontier = recordInput(intent, "frontier");
  exactRecordKeys(frontier, ["frontierRef", "originCheckpoint"], "GPT_CONTINUATION_FRONTIER_INVALID");
  const checkpointValue = frontier.originCheckpoint;
  if (!checkpointValue || typeof checkpointValue !== "object" || Array.isArray(checkpointValue)) {
    throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_INVALID");
  }
  const checkpoint = checkpointValue as Readonly<Record<string, unknown>>;
  exactRecordKeys(checkpoint, [
    "artifactRef", "assistantTurnId", "canonicalConversationUrl", "evidenceHash", "evidenceRef",
    "promptHash", "rawDomHash", "semanticTextHash", "sourceAttemptId", "turnMarker",
  ], "GPT_CONTINUATION_FRONTIER_INVALID");
  return Object.freeze({
    frontier_ref: hashField(frontier.frontierRef, "GPT_CONTINUATION_FRONTIER_INVALID"),
    origin_checkpoint: Object.freeze({
      source_attempt_id: textField(checkpoint.sourceAttemptId, "GPT_CONTINUATION_FRONTIER_INVALID"),
      assistant_turn_id: textField(checkpoint.assistantTurnId, "GPT_CONTINUATION_FRONTIER_INVALID"),
      artifact_ref: textField(checkpoint.artifactRef, "GPT_CONTINUATION_FRONTIER_INVALID"),
      raw_dom_hash: hashField(checkpoint.rawDomHash, "GPT_CONTINUATION_FRONTIER_INVALID"),
      semantic_text_hash: hashField(checkpoint.semanticTextHash, "GPT_CONTINUATION_FRONTIER_INVALID"),
      canonical_conversation_url: textField(
        checkpoint.canonicalConversationUrl, "GPT_CONTINUATION_FRONTIER_INVALID",
      ),
      prompt_hash: hashField(checkpoint.promptHash, "GPT_CONTINUATION_FRONTIER_INVALID"),
      turn_marker: textField(checkpoint.turnMarker, "GPT_CONTINUATION_FRONTIER_INVALID"),
      evidence_ref: textField(checkpoint.evidenceRef, "GPT_CONTINUATION_FRONTIER_INVALID"),
      evidence_hash: hashField(checkpoint.evidenceHash, "GPT_CONTINUATION_FRONTIER_INVALID"),
    }),
  });
};

export const sessionChildHandlers = {
  async persist_gpt_continuation(intent, context) {
    const hasFrontier = Object.prototype.hasOwnProperty.call(intent.input, "frontier");
    requireExactInputKeys(intent, hasFrontier ? [
      "authorizationRef", "currentCheckpoint", "frontier", "jobId", "ownerRef", "pluginId", "provider", "subjectRef",
    ] : ["authorizationRef", "currentCheckpoint", "jobId", "ownerRef", "pluginId", "provider", "subjectRef"]);
    const ref = controller(context).persist({
      continuationRef: `gpt-continuation:${gptExactCallIdentityHash(intent).slice(7)}`,
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
      authorizationRef: stringInput(intent, "authorizationRef"),
      provider: providerFrom(intent),
      currentCheckpoint: checkpointFrom(intent),
      frontier: hasFrontier ? frontierFrom(intent) : null,
    });
    return success({
      value: { continuationRef: ref }, candidateCount: null,
      observedSemantics: ["opaque GPT continuation", "plugin/subject/authorization bound"],
      committedMutation: "confirmed",
    });
  },

  async reserve_exact_gpt_continuation_once(intent, context) {
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
    const readback = controller(context).reserve({
      continuation_ref: `gpt-continuation:${reservationIdentityHash.slice(7)}`,
      reservation_kind: reservationKind,
      reservation_identity_hash: reservationIdentityHash,
      creator_job_id: intent.jobId,
      creator_plugin_id: intent.pluginId,
      creator_plugin_version: intent.pluginVersion,
      owner_ref: stringInput(intent, "ownerRef"),
      subject_ref: stringInput(intent, "subjectRef"),
      authorization_ref: stringInput(intent, "authorizationRef"),
      source_checkpoint_hash: derived
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
    return success({
      value: {
        continuationRef: readback.continuation_ref,
        reservationIdentityHash: readback.reservation_identity_hash,
        laneVersion: readback.lane_version,
        reservationFenceHash: readback.reservation_fence_hash,
        complete: readback.complete,
        opaqueReadGrantHash: readback.opaque_read_grant_hash,
      },
      candidateCount: null,
      observedSemantics: ["one reservation identity", "same continuation store", "reservation CAS read back"],
      committedMutation: "confirmed",
    });
  },

  async complete_exact_gpt_continuation_reservation_once(intent, context) {
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
    const stored = controller(context).complete({
      continuation_ref: `gpt-continuation:${reservationIdentityHash.slice(7)}`,
      reservation_identity_hash: reservationIdentityHash,
      creator_job_id: intent.jobId,
      lane_version: positiveIntegerField(intent.input.laneVersion, "GPT_CONTINUATION_COMPLETION_INVALID"),
      reservation_fence_hash: hashField(
        intent.input.reservationFenceHash, "GPT_CONTINUATION_COMPLETION_INVALID",
      ),
      provider: providerFrom(intent),
      checkpoint: textCheckpointFromRecord(recordInput(intent, "checkpoint"), "GPT_CONTINUATION_COMPLETION_INVALID"),
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
    return success({
      value: {
        continuationRef: stored.continuation_ref,
        reservationIdentityHash: stored.reservation_identity_hash,
        laneVersion: stored.lane_version,
        completionReceiptHash: stored.completion_receipt_hash,
      },
      candidateCount: null,
      observedSemantics: ["same reservation", "completion receipt committed", "reservation lane released"],
      committedMutation: "confirmed",
    });
  },

  async acquire_gpt_continuation_lane(intent, context) {
    const authorization = recordInput(intent, "authorization");
    const grant = authorization.kind === "continuation_lane_use_grant";
    requireExactInputKeys(intent, [
      "authorization", "continuationRef", ...(grant ? ["parentManifestHash", "parentManifestId"] : []),
      "ownerRef", "subjectRef",
    ]);
    exactRecordKeys(authorization, grant
      ? ["currentAuthorizationRef", "currentJobId", "kind", "opaqueLaneUseGrantHash"]
      : ["currentAuthorizationRef", "kind"], "GPT_CONTINUATION_AUTHORIZATION_INVALID");
    if (authorization.kind !== "row_authorization" && !grant) {
      throw executionFailure("failed", "GPT_CONTINUATION_AUTHORIZATION_INVALID");
    }
    const common = {
      continuationRef: stringInput(intent, "continuationRef"),
      jobId: intent.jobId,
      pluginId: intent.pluginId,
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
    } as const;
    const lane = controller(context).acquire(grant ? {
      ...common,
      authorization: {
        kind: "continuation_lane_use_grant",
        currentJobId: textField(authorization.currentJobId, "GPT_CONTINUATION_AUTHORIZATION_INVALID"),
        currentAuthorizationRef: textField(
          authorization.currentAuthorizationRef, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
        opaqueLaneUseGrantHash: hashField(
          authorization.opaqueLaneUseGrantHash, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
      },
      parentManifestId: stringInput(intent, "parentManifestId"),
      parentManifestHash: hashField(
        intent.input.parentManifestHash, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
      ),
    } : {
      ...common,
      authorization: {
        kind: "row_authorization",
        currentAuthorizationRef: textField(
          authorization.currentAuthorizationRef, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
      },
    });
    return success({
      value: lane, candidateCount: null,
      observedSemantics: ["one continuation", "lane CAS acquired", `lane-version:${lane.lane_version}`],
      committedMutation: "confirmed",
    });
  },

  async advance_gpt_continuation_lane(intent, context) {
    requireExactInputKeys(intent, ["currentCheckpoint", "jobId", "lane", "pluginId", "provider"]);
    controller(context).advance({
      lane: laneFrom(intent),
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      provider: providerFrom(intent),
      currentCheckpoint: checkpointFrom(intent),
    });
    return success({
      value: { advanced: true }, candidateCount: null,
      observedSemantics: ["lane version matched", "new turn identity persisted", "lane released"],
      committedMutation: "confirmed",
    });
  },

  async release_gpt_continuation_lane(intent, context) {
    requireExactInputKeys(intent, ["jobId", "lane"]);
    controller(context).release(laneFrom(intent), stringInput(intent, "jobId"));
    return success({
      value: { released: true }, candidateCount: null,
      observedSemantics: ["same lane owner", "lane released"], committedMutation: "confirmed",
    });
  },

} satisfies GptChildHandlerMap;
