export type VideoDownloadArtifact = {
  artifactRef: string;
  storageRef: string;
  filePath: string;
  sha256: string;
  artifactDisposition: "staging" | "final";
};

export type VideoArtifactDisposition = "staging" | "final";

export type WriteVideoArtifactInput = {
  missionId: string;
  runId: string;
  artifactId: string;
  extension: ".mp4" | ".webm" | ".m4v" | ".vtt" | ".srt";
  bytes: Uint8Array;
  contentType: string;
  createdAt: string;
  artifactDisposition?: VideoArtifactDisposition;
};

export type PromoteVideoArtifactInput = {
  artifact: VideoDownloadArtifact;
  destinationFilePath: string;
};

export type DeleteVideoArtifactInput = {
  artifact: VideoDownloadArtifact;
};

export interface VideoArtifactStoragePort {
  writeVideoArtifact(input: WriteVideoArtifactInput): Promise<VideoDownloadArtifact>;
  promoteVideoArtifact(input: PromoteVideoArtifactInput): Promise<VideoDownloadArtifact>;
  deleteVideoArtifact(input: DeleteVideoArtifactInput): Promise<void>;
}
