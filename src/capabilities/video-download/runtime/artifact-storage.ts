import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  VideoDownloadArtifact,
  VideoArtifactStoragePort,
  WriteVideoArtifactInput,
} from "../ports/video-artifact-storage-port.js";

const safeSegment = (value: string): string =>
  value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);

const buildArtifactPath = (baseDir: string, input: WriteVideoArtifactInput): string =>
  path.join(
    baseDir,
    "runtime-data",
    "video-download-artifacts",
    safeSegment(input.missionId),
    safeSegment(input.runId),
    `${safeSegment(input.artifactId)}${input.extension}`,
  );

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
      };
    },
  });
