import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { ScreenshotArtifactRefSchema } from "../schema.js";
import type { ScreenshotArtifactPort } from "../ports/screenshot-artifact-port.js";
import { SCREENSHOT_ARTIFACT_PORT_KIND } from "../shared/screenshot-artifact.js";

function createRootGuard(resolvedRootDir: string) {
  return (candidatePath: string): string => {
    const resolvedPath = path.resolve(candidatePath);
    const relativePath = path.relative(resolvedRootDir, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("artifact target escaped governed screenshot root");
    }
    return resolvedPath;
  };
}

export function createFilesystemScreenshotArtifactPort(outputRootDir: string): ScreenshotArtifactPort {
  const resolvedRootDir = path.resolve(outputRootDir);
  const assertInsideRoot = createRootGuard(resolvedRootDir);

  return {
    portKind: SCREENSHOT_ARTIFACT_PORT_KIND,
    getRootDir() {
      return resolvedRootDir;
    },
    async storeArtifact(input) {
      const targetDir = path.join(resolvedRootDir, input.childCapabilityId);
      await mkdir(targetDir, { recursive: true });
      const targetPath = assertInsideRoot(path.join(targetDir, input.fileName));
      await copyFile(input.sourceFilePath, targetPath, fsConstants.COPYFILE_EXCL);
      return ScreenshotArtifactRefSchema.parse({
        artifactId: `${input.evidenceId}:artifact`,
        evidenceId: input.evidenceId,
        storageRef: targetPath,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sha256: input.sha256,
        width: input.width,
        height: input.height,
        imageKind: input.imageKind,
        createdAt: input.createdAt,
      });
    },
  };
}