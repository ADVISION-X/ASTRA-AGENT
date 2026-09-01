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

export interface StoredGptContinuation {
  readonly continuation_ref: string;
  readonly origin_job_id: string;
  readonly plugin_id: string;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly authorization_ref: string;
  readonly conversation_identity_hash: `sha256:${string}`;
  readonly frontier_ref: `sha256:${string}` | null;
  readonly origin_provider: GptProviderContinuation;
  readonly origin_checkpoint: GptContinuationOriginCheckpoint | null;
  readonly provider: GptProviderContinuation;
  readonly current_checkpoint: GptContinuationCheckpoint | null;
  readonly lane_version: number;
  readonly lane_owner_job_id: string | null;
}

export interface GptContinuationStorePort {
  createGptContinuation(continuation: StoredGptContinuation): void;
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
