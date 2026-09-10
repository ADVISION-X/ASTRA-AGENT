import type {
  ForensicsAppendArtifactInput,
  ForensicsAppendRecordInput,
  ForensicsReadRecordRefInput,
  ForensicsReadArtifactRefInput,
  ForensicsAppendRecordResult,
  ForensicsAppendArtifactResult,
  ForensicsReadRecordResult,
  ForensicsReadArtifactResult,
} from "./schema.js";

type ForensicsAppendRecordRequest = Omit<ForensicsAppendRecordInput, "capabilityCallId"> & {
  correlationId?: string;
};
type ForensicsAppendArtifactRequest = Omit<ForensicsAppendArtifactInput, "capabilityCallId"> & {
  correlationId?: string;
};

interface ForensicsPersistenceAbilityGroup {
  appendRecord(input: ForensicsAppendRecordRequest): Promise<ForensicsAppendRecordResult>;
  appendArtifact(input: ForensicsAppendArtifactRequest): Promise<ForensicsAppendArtifactResult>;
  readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsReadRecordResult>;
  readArtifactRef(input: ForensicsReadArtifactRefInput): Promise<ForensicsReadArtifactResult>;
  readExactCallEvidence(input: Readonly<{
    missionId: string;
    runId: string;
    exactCallIdentityHash: `sha256:${string}`;
  }>): Promise<Readonly<{ recordRef: string; record: Readonly<Record<string, unknown>> }> | null>;
}

export type {
  ForensicsPersistenceAbilityGroup,
};
