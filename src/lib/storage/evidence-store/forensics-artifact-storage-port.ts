import { access } from "node:fs/promises";

import { ForensicsArtifactRefSchema, type ForensicsArtifactStoragePort } from "./forensics-storage-types.js";

const verifyArtifactRef = async (storageRef: string): Promise<boolean> => {
  try {
    await access(storageRef);
    return true;
  } catch (error) {
    return error instanceof Error ? false : Boolean(error);
  }
};

export function createEvidenceStoreForensicsArtifactStoragePort(): ForensicsArtifactStoragePort {
  return {
    async writeArtifactRef(input) {
      const artifactRef = ForensicsArtifactRefSchema.parse(input);
      if (!artifactRef.storageRef) {
        throw new Error(`Artifact ${artifactRef.artifactId} cannot be persisted without storageRef.`);
      }
      return artifactRef;
    },
    async verifyArtifactRef(input) {
      const artifactRef = ForensicsArtifactRefSchema.parse(input);
      if (!artifactRef.storageRef) {
        return false;
      }
      return verifyArtifactRef(artifactRef.storageRef);
    },
  };
}