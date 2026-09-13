import type { ForensicsReadArtifactInput, ForensicsReadArtifactResult } from "../../schema.js";
import type { GrassEyeStoragePort } from "../../../../lib/storage/index.js";
import { createForensicsProofTiming, resolveForensicsFailureReason } from "../../proof-support.js";
import { createArtifactRef } from "../../../../lib/storage/refs.js";

export async function executeReadArtifact(
  input: ForensicsReadArtifactInput,
  storage: GrassEyeStoragePort,
): Promise<ForensicsReadArtifactResult> {
  const startedAt = new Date().toISOString();
  try {
    const artifactRef = createArtifactRef(
      `artifact\0${input.missionId}\0${input.runId}\0${input.idempotencyKey}`,
    );
    const artifact = await storage.readArtifact(artifactRef);
    if (!artifact) throw new Error("FORENSICS_ARTIFACT_NOT_FOUND");
    return { status: "success", artifactRef,
      artifact: { ...artifact, content: new Uint8Array(artifact.content) },
      proof: { childCapabilityId: "read-artifact", artifactRef,
        integrityHash: artifact.integrityHash, status: "success",
        ...createForensicsProofTiming(startedAt) } };
  } catch (error) {
    const failureReason = resolveForensicsFailureReason(error);
    return { status: "failed", failureReason,
      proof: { childCapabilityId: "read-artifact", status: "failed", failureReason,
        missionId: input.missionId, runId: input.runId, ...createForensicsProofTiming(startedAt) } };
  }
}
