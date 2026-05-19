// Artifact storage port — Screenshot uses this to persist image bytes and get artifact refs.
// Screenshot does NOT manage artifact lifecycle, promotion, or cleanup via this port.

import type { ScreenshotArtifactRef } from "../schema-artifact.js";

export type WriteArtifactInput = {
  sourceTempFilePath: string;
  artifactId: string;
  mimeType: string;
  createdAt: string;
};

export interface ArtifactStoragePort {
  writeArtifact(input: WriteArtifactInput): Promise<ScreenshotArtifactRef>;
}
