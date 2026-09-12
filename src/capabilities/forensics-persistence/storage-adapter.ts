import type { ArtifactEnvelope, GrassEyeStoragePort } from "../../lib/storage/index.js";
import type { ForensicsAppendArtifactInput } from "./schema.js";
import type { AppendArtifactStorageResult, ForensicsStoragePort } from "./storage-port.js";

const buildArtifactEnvelope = (input: ForensicsAppendArtifactInput): ArtifactEnvelope => ({
  artifactType: input.artifactType,
  missionId: input.missionId,
  runId: input.runId,
  ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
  ...(input.mimeType ? { mimeType: input.mimeType } : {}),
  ...(input.content === undefined ? {} : { content: input.content }),
  idempotencyKey: input.idempotencyKey,
  createdAt: new Date().toISOString(),
});

export function createForensicsStorageAdapter(storage: GrassEyeStoragePort): ForensicsStoragePort {
  return {
    appendArtifact: (input): Promise<AppendArtifactStorageResult> =>
      storage.appendArtifact(buildArtifactEnvelope(input)),
    deleteArtifactsForMission: (missionId) => storage.deleteArtifactsForMission(missionId),
    readArtifact: (artifactRef) => storage.readArtifact(artifactRef),
  };
}
