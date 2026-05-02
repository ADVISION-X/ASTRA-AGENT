import type { ForensicsArtifactRef } from "../schema.js";

export interface ForensicsArtifactStoragePort {
  writeArtifactRef(input: ForensicsArtifactRef): Promise<ForensicsArtifactRef>;
}
