import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import sharp from "sharp";

import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import { readImageAsBase64 } from "./runtime-adapter-utils.js";

export type PreparedVisionImage = {
  sourcePath: string;
  base64: string;
  sourceBytes: number;
  preparedBytes: number;
  sourceHash: string;
  width: number | null;
  height: number | null;
  optimized: boolean;
  preparedPath: string;
};

const MAX_VISION_IMAGE_BYTES = 1_000_000;

export async function prepareOllamaVisionImage(imagePath: string): Promise<PreparedVisionImage> {
  const sourceStat = await stat(imagePath);
  if (sourceStat.size > MAX_VISION_IMAGE_BYTES) {
    throw new LocalAiRuntimeError(
      "missing_evidence",
      `Vision input ${imagePath} exceeds ${MAX_VISION_IMAGE_BYTES} bytes; upstream must call Screenshot Ability Group prepare-ai-input before local AI execution.`,
    );
  }

  const base64 = await readImageAsBase64(imagePath);
  const metadata = await sharp(imagePath).metadata();
  return {
    sourcePath: imagePath,
    preparedPath: imagePath,
    base64,
    sourceBytes: sourceStat.size,
    preparedBytes: sourceStat.size,
    sourceHash: createHash("sha256").update(base64).digest("hex"),
    width: typeof metadata.width === "number" ? metadata.width : null,
    height: typeof metadata.height === "number" ? metadata.height : null,
    optimized: false,
  };
}