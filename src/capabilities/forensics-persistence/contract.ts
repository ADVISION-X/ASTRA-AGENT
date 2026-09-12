import type {
  ForensicsAppendArtifactInput,
  ForensicsAppendArtifactResult,
  ForensicsReadArtifactRefInput,
  ForensicsReadArtifactResult,
} from "./schema.js";

type ForensicsAppendArtifactRequest = Omit<ForensicsAppendArtifactInput, "capabilityCallId"> & {
  correlationId?: string;
};

export interface ForensicsPersistenceAbilityGroup {
  appendArtifact(input: ForensicsAppendArtifactRequest): Promise<ForensicsAppendArtifactResult>;
  deleteArtifactsForMission(missionId: string): Promise<void>;
  readArtifactRef(input: ForensicsReadArtifactRefInput): Promise<ForensicsReadArtifactResult>;
}
