import type { ForensicsAppendArtifactInput, ForensicsAppendArtifactResult } from "../../schema.js";
import type { ArtifactEnvelope, GrassEyeStoragePort } from "../../../../lib/storage/index.js";
import {
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeAppendArtifact(
  input: ForensicsAppendArtifactInput,
  storage: GrassEyeStoragePort,
): Promise<ForensicsAppendArtifactResult> {
  const startedAt = new Date().toISOString();
  try {
    const envelope: ArtifactEnvelope = { artifactType: input.artifactType,
      missionId: input.missionId, runId: input.runId,
      ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      ...(input.content === undefined ? {} : { content: input.content }),
      idempotencyKey: input.idempotencyKey, createdAt: new Date().toISOString() };
    const result = await storage.appendArtifact(envelope);
    return {
      status: "success",
      artifactRef: result.artifactRef,
      proof: {
        childCapabilityId: "append-artifact",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
        artifactRef: result.artifactRef,
        storageRef: result.storageRef,
        integrityHash: result.integrityHash,
        status: "success", ...createForensicsProofTiming(startedAt),
      },
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: { childCapabilityId: "append-artifact", status: "failed", failureReason,
        missionId: input.missionId, runId: input.runId, ...createForensicsProofTiming(startedAt) },
    };
  }
}
