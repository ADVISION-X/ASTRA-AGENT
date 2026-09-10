/**
 * schema.ts — Generic record/artifact envelopes for append-only storage.
 *
 * This file contains NO business logic and NO capability knowledge.
 * Business-specific record modules must not appear here.
 */

type RecordType =
  | "evidence"
  | "failure";

type ArtifactType =
  | "ai_raw_output"
  | "other";

export type RecordEnvelope = {
  readonly recordType: RecordType;
  readonly missionId?: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly capabilityCallId?: string;
  readonly sourceAbilityGroupId?: string;
  readonly sourceChildCapabilityId?: string;
  readonly artifactRefs?: string[];
  readonly payload: unknown;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
};

export type ArtifactEnvelope = {
  readonly artifactType: ArtifactType;
  readonly missionId?: string;
  readonly runId?: string;
  readonly capabilityCallId?: string;
  readonly mimeType?: string;
  readonly content?: Uint8Array | string;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
};
