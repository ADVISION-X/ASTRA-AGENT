import type { ForensicsArtifactStoragePort } from "../ports/forensics-artifact-storage-port.js";
import type { ForensicsStoragePort } from "../ports/forensics-storage-port.js";
import type {
  ForensicsArtifactRef,
  ForensicsPolicyDecision,
  ForensicsRecordEnvelope,
  StoredForensicsRecord,
} from "../schema.js";

export async function persistForensicsArtifacts(input: {
  artifactStorage: ForensicsArtifactStoragePort;
  artifactRefs: ForensicsArtifactRef[];
  policyDecision: ForensicsPolicyDecision;
}): Promise<ForensicsArtifactRef[]> {
  const persistedArtifacts: ForensicsArtifactRef[] = [];

  for (const artifactRef of input.artifactRefs) {
    if (artifactRef.storageRef) {
      const verified = await input.artifactStorage.verifyArtifactRef(artifactRef);
      if (!verified) {
        throw new Error(`Artifact ref could not be verified: ${artifactRef.artifactId}`);
      }
      persistedArtifacts.push(artifactRef);
      continue;
    }

    if (!input.policyDecision.allowExternalArtifactRef) {
      throw new Error(`Artifact ref ${artifactRef.artifactId} is missing storageRef.`);
    }

    persistedArtifacts.push(await input.artifactStorage.writeArtifactRef(artifactRef));
  }

  return persistedArtifacts;
}

export async function writeForensicsEnvelope(input: {
  recordStorage: ForensicsStoragePort;
  envelope: ForensicsRecordEnvelope;
  policyDecision: ForensicsPolicyDecision;
}): Promise<StoredForensicsRecord> {
  switch (input.policyDecision.storageOperation) {
    case "append-record":
      return input.recordStorage.appendRecord(input.envelope);
    case "replace-record-by-round":
      return input.recordStorage.replaceRecordByRound(input.envelope);
    case "replace-record-by-session":
      return input.recordStorage.replaceRecordBySession(input.envelope);
    case "update-runtime-snapshot":
      return input.recordStorage.updateRuntimeSnapshot(input.envelope);
  }
}
