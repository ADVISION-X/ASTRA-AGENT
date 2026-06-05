import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export type ValidatedMediaSource = {
  filePath: string;
  extension: string;
  byteSize: number;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export const validateMediaSourceFile = async (
  inputFilePath: string,
): Promise<ValidatedMediaSource> => {
  const filePath = await realpath(inputFilePath);
  const details = await stat(filePath);
  if (!details.isFile()) {
    throw new Error("media_input_must_be_file");
  }
  return {
    filePath,
    extension: path.extname(filePath).toLowerCase(),
    byteSize: details.size,
  };
};

export const isSupportedImageExtension = (extension: string): boolean =>
  IMAGE_EXTENSIONS.has(extension);

export const isSupportedVideoExtension = (extension: string): boolean =>
  VIDEO_EXTENSIONS.has(extension);
