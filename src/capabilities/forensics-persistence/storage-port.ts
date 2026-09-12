import type { ForensicsAppendArtifactInput } from "./schema.js";

export interface AppendArtifactStorageResult {
  readonly artifactRef: string;
  readonly storageRef: string;
  readonly integrityHash: string;
}

export interface ForensicsStoragePort {
  appendArtifact(input: ForensicsAppendArtifactInput): Promise<AppendArtifactStorageResult>;
  deleteArtifactsForMission(missionId: string): Promise<void>;
  readArtifact(artifactRef: string): Promise<Readonly<{
    content: Uint8Array;
    mimeType?: string;
    integrityHash: string;
  }> | null>;
}
