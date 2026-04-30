import path from "node:path";

import type { ScreenshotChildCapabilityId, ScreenshotImageKind } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export async function runArtifactStorageGate(input: {
  context: ScreenshotRuntimeContext;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  outputFilePath: string;
  imageKind: ScreenshotImageKind;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
}): Promise<{
  decision: { status: "passed" | "failed"; reason: string | null };
  artifactRef: Awaited<ReturnType<ScreenshotRuntimeContext["artifactPort"]["storeArtifact"]>> | null;
  outputHash: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  try {
    const rootDir = input.context.artifactPort.getRootDir();
    const fileExtension = path.extname(input.outputFilePath) || (input.mimeType === "image/jpeg" ? ".jpg" : ".png");
    const fileName = `${input.evidenceId}${fileExtension}`;
    const outputHash = await input.context.imageProcessingPort.hashFile(input.outputFilePath);
    const artifactRef = await input.context.artifactPort.storeArtifact({
      childCapabilityId: input.childCapabilityId,
      evidenceId: input.evidenceId,
      sourceFilePath: input.outputFilePath,
      fileName,
      mimeType: input.mimeType,
      sha256: outputHash,
      width: input.width,
      height: input.height,
      imageKind: input.imageKind,
      createdAt: input.createdAt,
    });
    const resolvedStorageRef = path.resolve(artifactRef.storageRef);
    const relativePath = path.relative(rootDir, resolvedStorageRef);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return {
        decision: { status: "failed", reason: "artifact_path_outside_root" },
        artifactRef: null,
        outputHash: null,
        failure: createScreenshotFailure({
          code: "artifact_path_invalid",
          message: "Screenshot artifact storage escaped the governed root directory.",
        }),
      };
    }
    return {
      decision: { status: "passed", reason: null },
      artifactRef,
      outputHash,
      failure: null,
    };
  } catch (error) {
    return {
      decision: { status: "failed", reason: "artifact_write_failed" },
      artifactRef: null,
      outputHash: null,
      failure: createScreenshotFailure({
        code: "artifact_write_failed",
        message: "Screenshot artifact persistence failed.",
        detail: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
