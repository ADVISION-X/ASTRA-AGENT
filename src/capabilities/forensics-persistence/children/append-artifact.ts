import { randomUUID } from "node:crypto";

import type { ForensicsAppendArtifactInput, ForensicsResult } from "../schema.js";
import type { ForensicsStoragePort } from "../storage-port.js";

export async function executeAppendArtifact(
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const result = await storage.appendArtifact(input);
    const endedAt = new Date().toISOString();
    return {
      status: "success",
      artifactRef: result.artifactRef,
      proof: {
        proofId: randomUUID(),
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "append-artifact",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        capabilityCallId: input.capabilityCallId,
        artifactRef: result.artifactRef,
        storageRef: result.storageRef,
        integrityHash: result.integrityHash,
        status: "success",
        startedAt,
        endedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    };
  } catch (err) {
    const endedAt = new Date().toISOString();
    return {
      status: "failed",
      failureReason: err instanceof Error ? err.message : String(err),
      proof: {
        proofId: randomUUID(),
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "append-artifact",
        missionId: input.missionId,
        runId: input.runId,
        status: "failed",
        failureReason: err instanceof Error ? err.message : String(err),
        startedAt,
        endedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    };
  }
}
