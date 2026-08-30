import { rm } from "node:fs/promises";
import path from "node:path";

import { executionFailure } from "../../typed-failure.js";
import type { GeneratedImageArtifact } from "./plugin.js";

const temporaryRoot = (dataDir: string): string => path.resolve(dataDir, "generated-images");

export const cleanupGeneratedImageTemporaryFiles = async (dataDir: string): Promise<void> => {
  await rm(temporaryRoot(dataDir), { recursive: true, force: true });
};

export const generatedImageTemporaryDirectory = (
  dataDir: string,
  image: GeneratedImageArtifact,
): string => {
  const root = temporaryRoot(dataDir);
  const localPath = path.resolve(image.local_path);
  const originalPath = path.resolve(image.original_local_path);
  const directory = path.dirname(localPath);
  if (!directory.startsWith(`${root}${path.sep}`)
    || path.dirname(originalPath) !== directory
    || path.basename(localPath) !== `${image.sha256.slice("sha256:".length)}.webp`
    || path.basename(originalPath) !== `${image.original_sha256.slice("sha256:".length)}.original`) {
    throw executionFailure("failed", "GENERATED_IMAGE_TEMPORARY_PATH_INVALID");
  }
  return directory;
};
