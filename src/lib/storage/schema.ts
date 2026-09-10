export type ArtifactEnvelope = {
  readonly artifactType: "ai_raw_output" | "other";
  readonly missionId?: string;
  readonly runId?: string;
  readonly capabilityCallId?: string;
  readonly mimeType?: string;
  readonly content?: Uint8Array | string;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
};
