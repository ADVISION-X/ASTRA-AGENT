export interface GptProviderContinuation {
  readonly provider_page_url: string;
  readonly prior_task_id: string;
  readonly prior_prompt_hash: `sha256:${string}`;
  readonly prior_raw_output_hash: `sha256:${string}`;
  readonly prior_turn_marker: string;
}

export interface GptContinuationOriginCheckpoint {
  readonly source_attempt_id: string;
  readonly assistant_turn_id: string;
  readonly artifact_ref: string;
  readonly raw_dom_hash: `sha256:${string}`;
  readonly semantic_text_hash: `sha256:${string}`;
  readonly canonical_conversation_url: string;
  readonly prompt_hash: `sha256:${string}`;
  readonly turn_marker: string;
  readonly evidence_ref: string;
  readonly evidence_hash: `sha256:${string}`;
}

export interface GptContinuationTextCheckpoint extends GptContinuationOriginCheckpoint {
  readonly checkpoint_kind: "text";
}

export interface GptContinuationGeneratedImageCheckpoint {
  readonly checkpoint_kind: "generated_image";
  readonly source_attempt_id: string;
  readonly assistant_turn_id: string;
  readonly canonical_conversation_url: string;
  readonly prompt_hash: `sha256:${string}`;
  readonly media_hash: `sha256:${string}`;
  readonly turn_marker: string;
  readonly original_artifact_ref: string;
  readonly original_sha256: `sha256:${string}`;
  readonly original_bytes: number;
  readonly original_media_type: `image/${string}`;
  readonly original_width: number;
  readonly original_height: number;
  readonly webp_artifact_ref: string;
  readonly webp_sha256: `sha256:${string}`;
  readonly webp_bytes: number;
  readonly media_type: "image/webp";
  readonly width: 1200;
  readonly height: 630;
  readonly evidence_ref: string;
  readonly evidence_hash: `sha256:${string}`;
  readonly predecessor_text_checkpoint: GptContinuationTextCheckpoint;
}

export type GptContinuationCheckpoint =
  | GptContinuationTextCheckpoint
  | GptContinuationGeneratedImageCheckpoint;

export interface GptContinuationFrontierBinding {
  readonly frontier_ref: `sha256:${string}`;
  readonly origin_checkpoint: GptContinuationOriginCheckpoint;
}

export type GptContinuationReservationKind = "persisted" | "reusable_origin" | "derived_continuation";

export interface GptContinuationReservation {
  readonly continuation_ref: string;
  readonly reservation_kind: Exclude<GptContinuationReservationKind, "persisted">;
  readonly reservation_identity_hash: `sha256:${string}`;
  readonly creator_job_id: string;
  readonly creator_plugin_id: string;
  readonly creator_plugin_version: number;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly authorization_ref: string;
  readonly source_checkpoint_hash: `sha256:${string}` | null;
  readonly reservation_fence_hash: `sha256:${string}`;
  readonly reservation_effect_hash: `sha256:${string}`;
  readonly origin_provenance_hash: `sha256:${string}`;
  readonly semantic_contract_hash: `sha256:${string}` | null;
  readonly lane_version: number;
}

export interface GptSemanticAdmissionReceipt {
  readonly schema_version: "exact-semantic-admission-receipt.v1";
  readonly artifact_ref: string;
  readonly artifact_hash: `sha256:${string}`;
  readonly contract_hash: `sha256:${string}`;
  readonly contract_evaluation_hash: `sha256:${string}`;
  readonly outcome: "accepted";
}

export interface GptContinuationCompletionInput {
  readonly continuation_ref: string;
  readonly reservation_identity_hash: `sha256:${string}`;
  readonly creator_job_id: string;
  readonly lane_version: number;
  readonly reservation_fence_hash: `sha256:${string}`;
  readonly provider: GptProviderContinuation;
  readonly checkpoint: GptContinuationTextCheckpoint;
  readonly artifact_ref: string;
  readonly artifact_hash: `sha256:${string}`;
  readonly semantic_admission_receipt_ref: string;
  readonly semantic_admission_receipt_hash: `sha256:${string}`;
  readonly semantic_admission_receipt: GptSemanticAdmissionReceipt;
  readonly opaque_read_grant_hash: `sha256:${string}`;
  readonly completion_receipt_hash: `sha256:${string}`;
}

export interface StoredGptContinuation {
  readonly continuation_ref: string;
  readonly reservation_kind: GptContinuationReservationKind;
  readonly reservation_identity_hash: `sha256:${string}`;
  readonly origin_job_id: string;
  readonly origin_plugin_version: number;
  readonly plugin_id: string;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly authorization_ref: string;
  readonly conversation_identity_hash: `sha256:${string}`;
  readonly frontier_ref: `sha256:${string}` | null;
  readonly source_checkpoint_hash: `sha256:${string}` | null;
  readonly reservation_fence_hash: `sha256:${string}` | null;
  readonly reservation_effect_hash: `sha256:${string}` | null;
  readonly origin_provenance_hash: `sha256:${string}` | null;
  readonly semantic_contract_hash: `sha256:${string}` | null;
  readonly artifact_ref: string | null;
  readonly artifact_hash: `sha256:${string}` | null;
  readonly semantic_admission_receipt_ref: string | null;
  readonly semantic_admission_receipt_hash: `sha256:${string}` | null;
  readonly semantic_admission_receipt: GptSemanticAdmissionReceipt | null;
  readonly opaque_read_grant_hash: `sha256:${string}` | null;
  readonly completion_receipt_hash: `sha256:${string}` | null;
  readonly origin_provider: GptProviderContinuation;
  readonly origin_checkpoint: GptContinuationOriginCheckpoint | null;
  readonly provider: GptProviderContinuation;
  readonly current_checkpoint: GptContinuationCheckpoint | null;
  readonly lane_version: number;
  readonly lane_owner_job_id: string | null;
}

export type NewStoredGptContinuation = Readonly<{
  continuation_ref: string;
  origin_job_id: string;
  plugin_id: string;
  owner_ref: string;
  subject_ref: string;
  authorization_ref: string;
  conversation_identity_hash: `sha256:${string}`;
  frontier_ref: `sha256:${string}` | null;
  origin_provider: GptProviderContinuation;
  origin_checkpoint: GptContinuationOriginCheckpoint | null;
  provider: GptProviderContinuation;
  current_checkpoint: GptContinuationCheckpoint | null;
  lane_version: number;
  lane_owner_job_id: string | null;
}>;

export interface GptContinuationReservationReadback extends GptContinuationReservation {
  readonly complete: boolean;
  readonly opaque_read_grant_hash: `sha256:${string}` | null;
}

export interface GptContinuationExecutionBinding {
  readonly job_id: string;
  readonly plugin_id: string;
  readonly plugin_version: number;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly authorization_ref: string;
}

export const gptContinuationReservationComplete = (stored: StoredGptContinuation): boolean =>
  stored.current_checkpoint !== null
  && stored.artifact_ref !== null
  && stored.artifact_hash !== null
  && stored.semantic_admission_receipt_ref !== null
  && stored.semantic_admission_receipt_hash !== null
  && stored.semantic_contract_hash !== null
  && stored.semantic_admission_receipt !== null
  && stored.opaque_read_grant_hash !== null
  && stored.completion_receipt_hash !== null
  && stored.lane_owner_job_id === null;

export const gptContinuationUsable = (stored: StoredGptContinuation): boolean =>
  stored.reservation_kind === "persisted"
    ? stored.current_checkpoint !== null
      && stored.lane_owner_job_id === null
    : gptContinuationReservationComplete(stored);

export interface GptContinuationStorePort {
  createGptContinuation(continuation: NewStoredGptContinuation): void;
  readGptContinuationExecutionBinding(jobId: string): GptContinuationExecutionBinding | null;
  reserveExactGptContinuation(reservation: GptContinuationReservation): GptContinuationReservationReadback;
  completeExactGptContinuationReservation(input: GptContinuationCompletionInput): StoredGptContinuation;
  readGptContinuation(continuationRef: string): StoredGptContinuation | null;
  readGptContinuationForFrontier(frontierRef: `sha256:${string}`): StoredGptContinuation | null;
  acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation;
  advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    currentCheckpoint: GptContinuationCheckpoint;
    conversationIdentityHash: `sha256:${string}`;
  }>): void;
  releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void;
}
