import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { ScreenshotArtifactRefSchema } from "../schema.js";
import { SCREENSHOT_ARTIFACT_PORT_KIND } from "../shared/screenshot-artifact.js";

export interface ScreenshotArtifactPort {
  readonly portKind: "filesystem-screenshot-artifact-port";
  storeArtifact(input: {
    childCapabilityId: string;
    evidenceId: string;
    sourceFilePath: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    width: number;
    height: number;
    imageKind: "evidence_original" | "evidence_optimized" | "ai_input";
    createdAt: string;
  }): Promise<ReturnType<typeof ScreenshotArtifactRefSchema.parse>>;
  getRootDir(): string;
}

export function createFilesystemScreenshotArtifactPort(outputRootDir: string): ScreenshotArtifactPort {
  const resolvedRootDir = path.resolve(outputRootDir);

  return {
    portKind: SCREENSHOT_ARTIFACT_PORT_KIND,
    getRootDir() {
      return resolvedRootDir;
    },
    async storeArtifact(input) {
      const targetDir = path.join(resolvedRootDir, input.childCapabilityId);
      await mkdir(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, input.fileName);
      await copyFile(input.sourceFilePath, targetPath);
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
