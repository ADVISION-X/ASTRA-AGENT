import { ForensicsArtifactRefSchema, type ForensicsArtifactStoragePort } from "./forensics-storage-types.js";

export function createEvidenceStoreForensicsArtifactStoragePort(): ForensicsArtifactStoragePort {
  return {
    async writeArtifactRef(input) {
      return ForensicsArtifactRefSchema.parse(input);
    },
  };
}