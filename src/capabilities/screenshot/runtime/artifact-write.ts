import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type { ScreenshotArtifactRef } from "../schema-artifact.js";

export function createFilesystemArtifactStoragePort(baseDir: string): ArtifactStoragePort {
  return {
    async writeArtifact(input) {
      await mkdir(baseDir, { recursive: true });

      const ext = input.mimeType.includes("png") ? ".png" : ".jpg";
      const fileName = `${input.artifactId}${ext}`;
      const destPath = path.join(baseDir, fileName);

      const bytes = await readFile(input.sourceTempFilePath);
      await writeFile(destPath, bytes);

      const sha256 = createHash("sha256").update(bytes).digest("hex");

      const ref: ScreenshotArtifactRef = {
        artifactId: input.artifactId,
        storageRef: destPath,
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
        sha256,
        createdAt: input.createdAt,
      };
      return ref;
    },
  };
}
