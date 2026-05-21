export type VideoDownloadArtifact = {
  artifactRef: string;
  storageRef: string;
  filePath: string;
  sha256: string;
};

export type WriteVideoArtifactInput = {
  missionId: string;
  runId: string;
  artifactId: string;
  extension: ".mp4" | ".webm" | ".m4v";
  bytes: Uint8Array;
  contentType: string;
  createdAt: string;
};

export interface VideoArtifactStoragePort {
  writeVideoArtifact(input: WriteVideoArtifactInput): Promise<VideoDownloadArtifact>;
}
