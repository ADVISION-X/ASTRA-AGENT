import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DeleteVideoArtifactInput,
  PromoteVideoArtifactInput,
  VideoDownloadArtifact,
  VideoArtifactStoragePort,
  VideoArtifactDisposition,
  WriteVideoArtifactInput,
} from "../ports/video-artifact-storage-port.js";

const safeSegment = (value: string): string =>
  value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);

const buildArtifactRoot = (
  baseDir: string,
  disposition: VideoArtifactDisposition,
): string => disposition === "staging"
  ? path.join(baseDir, "runtime-data", "video-download-staging")
  : path.join(baseDir, "runtime-data", "video-download-artifacts");

const buildArtifactPath = (baseDir: string, input: WriteVideoArtifactInput): string =>
  path.join(
    buildArtifactRoot(baseDir, input.artifactDisposition ?? "final"),
    safeSegment(input.missionId),
    safeSegment(input.runId),
    `${safeSegment(input.artifactId)}${input.extension}`,
  );

const sha256ForFile = async (filePath: string): Promise<string> =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

const buildArtifactRecord = async (input: {
  artifactId: string;
  filePath: string;
  artifactDisposition: VideoArtifactDisposition;
}): Promise<VideoDownloadArtifact> => ({
  artifactRef: `video-download://${input.artifactId}`,
  storageRef: input.filePath,
  filePath: input.filePath,
  sha256: await sha256ForFile(input.filePath),
  artifactDisposition: input.artifactDisposition,
});

const promoteVideoArtifact = async (
  input: PromoteVideoArtifactInput,
): Promise<VideoDownloadArtifact> => {
  await mkdir(path.dirname(input.destinationFilePath), { recursive: true });
  await rename(input.artifact.filePath, input.destinationFilePath);
  const artifactId = path.basename(input.destinationFilePath, path.extname(input.destinationFilePath));
  return buildArtifactRecord({
    artifactId,
    filePath: input.destinationFilePath,
    artifactDisposition: "final",
  });
};

const deleteVideoArtifact = async (input: DeleteVideoArtifactInput): Promise<void> => {
  await rm(input.artifact.filePath, { force: true });
};

export const createFilesystemVideoArtifactStoragePort = (
  dataDir: string,
): VideoArtifactStoragePort => ({
    async writeVideoArtifact(input): Promise<VideoDownloadArtifact> {
      const filePath = buildArtifactPath(dataDir, input);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.bytes);
      const sha256 = createHash("sha256").update(input.bytes).digest("hex");
      const artifactRef = `video-download://${input.artifactId}`;
      return {
        artifactRef,
        storageRef: filePath,
        filePath,
        sha256,
        artifactDisposition: input.artifactDisposition ?? "final",
      };
    },
    promoteVideoArtifact,
    deleteVideoArtifact,
  });
