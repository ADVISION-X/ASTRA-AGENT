import type { ArtifactEnvelope } from "./schema.js";

export type AppendArtifactResult = Readonly<{
  artifactRef: string;
  storageRef: string;
  integrityHash: string;
}>;

export interface GrassEyeStoragePort {
  appendArtifact(artifact: ArtifactEnvelope): Promise<AppendArtifactResult>;
  readArtifact(artifactRef: string): Promise<Readonly<{
    content: Uint8Array;
    mimeType?: string;
    integrityHash: string;
  }> | null>;
}
