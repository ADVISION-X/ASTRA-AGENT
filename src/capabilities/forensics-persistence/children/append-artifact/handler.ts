import type { ForensicsAppendArtifactInput, ForensicsAppendArtifactResult } from "../../schema.js";
import type { ForensicsStoragePort } from "../../storage-port.js";
import {
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeAppendArtifact(
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsAppendArtifactResult> {
  const startedAt = new Date().toISOString();
  try {
    const result = await storage.appendArtifact(input);
    return {
      status: "success",
      artifactRef: result.artifactRef,
      proof: {
        childCapabilityId: "append-artifact",
        missionId: input.missionId,
        runId: input.runId,
        capabilityCallId: input.capabilityCallId,
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
