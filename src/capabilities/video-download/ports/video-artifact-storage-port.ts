import type { VideoDownloadArtifact } from "../schema.js";

export type WriteVideoArtifactInput = {
  missionId: string;
  runId: string;
  artifactId: string;
  extension: ".mp4";
  bytes: Uint8Array;
  contentType: string;
  createdAt: string;
};

export interface VideoArtifactStoragePort {
  writeVideoArtifact(input: WriteVideoArtifactInput): Promise<VideoDownloadArtifact>;
}
