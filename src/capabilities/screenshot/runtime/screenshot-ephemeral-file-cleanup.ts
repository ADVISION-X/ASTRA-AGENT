import { rm } from "node:fs/promises";
import path from "node:path";

type BurnEphemeralScreenshotFileResult = {
  attempted: boolean;
  deleted: boolean;
  reason: string | null;
};

const normalizePath = (filePath: string): string => path.resolve(filePath);

function isSamePath(left: string | null, right: string | null): boolean {
  return Boolean(left && right) && normalizePath(left!) === normalizePath(right!);
}

export async function burnEphemeralScreenshotFile(input: {
  outputFilePath: string;
  retainedArtifactStorageRef: string | null;
}): Promise<BurnEphemeralScreenshotFileResult> {
  if (isSamePath(input.outputFilePath, input.retainedArtifactStorageRef)) {
    return {
      attempted: false,
      deleted: false,
      reason: "output_is_retained_artifact",
    };
  }

  try {
    await rm(input.outputFilePath, { force: true });
    return {
      attempted: true,
      deleted: true,
      reason: null,
    };
  } catch (error) {
    return {
      attempted: true,
      deleted: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
