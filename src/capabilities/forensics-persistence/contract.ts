import type {
  ForensicsAppendArtifactInput,
  ForensicsAppendArtifactResult,
  ForensicsReadArtifactInput,
  ForensicsReadArtifactResult,
} from "./schema.js";

type ForensicsAppendArtifactRequest = Omit<ForensicsAppendArtifactInput, "capabilityCallId"> & {
  correlationId?: string;
};

export interface ForensicsPersistenceAbilityGroup {
  appendArtifact(input: ForensicsAppendArtifactRequest): Promise<ForensicsAppendArtifactResult>;
  deleteArtifactsForMission(missionId: string): Promise<void>;
  readArtifact(input: ForensicsReadArtifactInput): Promise<ForensicsReadArtifactResult>;
}
