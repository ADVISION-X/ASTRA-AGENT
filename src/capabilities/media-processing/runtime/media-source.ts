import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export type ValidatedMediaSource = {
  filePath: string;
  extension: string;
  byteSize: number;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

const isWithinRoot = (filePath: string, root: string): boolean => {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const validateMediaSourceFile = async (
  inputFilePath: string,
  allowedRoots: readonly string[],
): Promise<ValidatedMediaSource> => {
  const filePath = await realpath(inputFilePath);
  const canonicalRoots = await Promise.all(allowedRoots.map((root) => realpath(root).catch(() => root)));
  if (!canonicalRoots.some((root) => isWithinRoot(filePath, root))) {
    throw new Error("media_input_outside_allowed_roots");
  }
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
