export interface GptProviderContinuation {
  readonly provider_page_url: string;
  readonly prior_task_id: string;
  readonly prior_prompt_hash: `sha256:${string}`;
  readonly prior_raw_output_hash: `sha256:${string}`;
  readonly prior_turn_marker: string;
}

export interface StoredGptContinuation {
  readonly continuation_ref: string;
  readonly origin_job_id: string;
  readonly plugin_id: string;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly authorization_ref: string;
  readonly conversation_identity_hash: `sha256:${string}`;
  readonly provider: GptProviderContinuation;
  readonly lane_version: number;
  readonly lane_owner_job_id: string | null;
}

export interface GptContinuationStorePort {
  createGptContinuation(continuation: StoredGptContinuation): void;
  readGptContinuation(continuationRef: string): StoredGptContinuation | null;
  acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation;
  advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    conversationIdentityHash: `sha256:${string}`;
  }>): void;
  releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void;
}
