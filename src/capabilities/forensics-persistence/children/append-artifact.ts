import type { ForensicsAppendArtifactInput, ForensicsResult } from "../schema.js";
import type { ForensicsStoragePort } from "../storage-port.js";
import {
  buildForensicsFailureProof,
  buildForensicsSuccessProof,
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../proof-support.js";

export async function executeAppendArtifact(
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const result = await storage.appendArtifact(input);
    return {
      status: "success",
      artifactRef: result.artifactRef,
      proof: buildForensicsSuccessProof({
        childCapabilityId: "append-artifact",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        capabilityCallId: input.capabilityCallId,
        artifactRef: result.artifactRef,
        storageRef: result.storageRef,
        integrityHash: result.integrityHash,
      }, createForensicsProofTiming(startedAt)),
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: buildForensicsFailureProof(
        "append-artifact",
        failureReason,
        createForensicsProofTiming(startedAt),
        {
        missionId: input.missionId,
        runId: input.runId,
        },
      ),
    };
  }
}
