import path from "node:path";

import type { ScreenshotChildCapabilityId, ScreenshotImageKind } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function buildArtifactStorageFailure(reason: string, message: string, detail: string | null = null) {
  return {
    decision: { status: "failed" as const, reason },
    artifactRef: null,
    outputHash: null,
    failure: createScreenshotFailure({
      code: reason === "artifact_path_outside_root" ? "artifact_path_invalid" : "artifact_write_failed",
      message,
      detail: detail ?? undefined,
    }),
  };
}

function resolveArtifactFileExtension(outputFilePath: string, mimeType: string) {
  return path.extname(outputFilePath) || (mimeType === "image/jpeg" ? ".jpg" : ".png");
}

function isArtifactStorageInsideRoot(rootDir: string, storageRef: string) {
  const relativePath = path.relative(rootDir, path.resolve(storageRef));
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function resolveArtifactStorageGate(input: {
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
  const rootDir = input.context.artifactPort.getRootDir();
  const fileName = `${input.evidenceId}${resolveArtifactFileExtension(input.outputFilePath, input.mimeType)}`;

  try {
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

    if (!isArtifactStorageInsideRoot(rootDir, artifactRef.storageRef)) {
      return buildArtifactStorageFailure(
        "artifact_path_outside_root",
        "Screenshot artifact storage escaped the governed root directory.",
      );
    }

    return {
      decision: { status: "passed", reason: null },
      artifactRef,
      outputHash,
      failure: null,
    };
  } catch (error) {
    return buildArtifactStorageFailure(
      "artifact_write_failed",
      "Screenshot artifact persistence failed.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

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
  return resolveArtifactStorageGate(input);
}
