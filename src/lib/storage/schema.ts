/**
 * schema.ts — Generic record/artifact envelopes for append-only storage.
 *
 * This file contains NO business logic and NO capability knowledge.
 * Business-specific record modules must not appear here.
 */

type RecordType =
  | "ai_result"
  | "ability_result"
  | "observation"
  | "evidence"
  | "visual_evidence"
  | "failure"
  | "failed"
  | "mission_event";

type ArtifactType =
  | "screenshot"
  | "coordinate_grid"
  | "ai_raw_output"
  | "ai_json_output"
  | "runtime_log"
  | "other";

export type RecordEnvelope = {
  readonly recordType: RecordType;
  readonly missionId?: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly roundId?: string;
  readonly stepId?: string;
  readonly capabilityCallId?: string;
  readonly sourceAbilityGroupId?: string;
  readonly sourceChildCapabilityId?: string;
  readonly parentRefs?: string[];
  readonly artifactRefs?: string[];
  readonly payload: unknown;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
};

export type ArtifactEnvelope = {
  readonly artifactType: ArtifactType;
  readonly missionId?: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly roundId?: string;
  readonly capabilityCallId?: string;
  readonly mimeType?: string;
  readonly content?: Uint8Array | string;
  readonly bytesRef?: string;
  readonly sourceRef?: string;
  readonly parentRefs?: string[];
  readonly idempotencyKey?: string;
  readonly createdAt: string;
};
