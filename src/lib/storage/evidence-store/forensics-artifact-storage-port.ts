import { access } from "node:fs/promises";

import { ForensicsArtifactRefSchema } from "../../../capabilities/forensics-persistence/schema.js";
import type { ForensicsArtifactStoragePort } from "../../../capabilities/forensics-persistence/ports/forensics-artifact-storage-port.js";

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