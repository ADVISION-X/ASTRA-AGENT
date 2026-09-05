import type { ForensicsReadArtifactRefInput, ForensicsResult } from "../../schema.js";
import type { ForensicsStoragePort } from "../../storage-port.js";
import {
  buildForensicsFailureProof,
  buildForensicsSuccessProof,
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeReadArtifactRef(
  input: ForensicsReadArtifactRefInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const artifact = await storage.readArtifact(input.artifactRef);
    if (!artifact) throw new Error("FORENSICS_ARTIFACT_REF_NOT_FOUND");
    return {
      status: "success",
      artifactRef: input.artifactRef,
      artifact: { ...artifact, content: new Uint8Array(artifact.content) },
      proof: buildForensicsSuccessProof({
        childCapabilityId: "read-artifact-ref",
        artifactRef: input.artifactRef,
        integrityHash: artifact.integrityHash,
      }, createForensicsProofTiming(startedAt)),
    };
  } catch (error) {
    const failureReason = resolveForensicsFailureReason(error);
    return {
      status: "failed",
      failureReason,
      proof: buildForensicsFailureProof(
        "read-artifact-ref",
        failureReason,
        createForensicsProofTiming(startedAt),
        { artifactRef: input.artifactRef },
      ),
    };
  }
}
