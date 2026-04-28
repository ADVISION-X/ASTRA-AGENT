import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import { createId } from "../../../lib/local-runtime/ids.js";
import type { ScreenshotBoundingBox, ScreenshotChildCapabilityId, ScreenshotCoordinateSpace, ScreenshotScaleMapping } from "../contract.js";

const execFileAsync = promisify(execFile);

export type ImageDimensions = {
  width: number;
  height: number;
};

export async function createFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function readImageDimensions(filePath: string): Promise<ImageDimensions> {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for ${filePath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

export async function ensureCapabilityOutputDir(rootDir: string, childCapabilityId: ScreenshotChildCapabilityId): Promise<string> {
  const outputDir = path.join(rootDir, childCapabilityId);
  await mkdir(outputDir, { recursive: true });
  return outputDir;
}

export function createScreenshotEvidenceId(childCapabilityId: ScreenshotChildCapabilityId): string {
  return createId(childCapabilityId.replaceAll("-", "_"));
}

export async function copyArtifactToOutput(input: {
  rootDir: string;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  sourceFilePath: string;
  extension?: string;
}): Promise<string> {
  const outputDir = await ensureCapabilityOutputDir(input.rootDir, input.childCapabilityId);
  const artifactPath = path.join(outputDir, `${input.evidenceId}${input.extension ?? (path.extname(input.sourceFilePath) || ".png")}`);
  await copyFile(input.sourceFilePath, artifactPath);
  return artifactPath;
}

export async function captureDesktopScreenArtifact(outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync("screencapture", ["-x", outputPath]);
}

export function validateBoundingBox(input: {
  box: ScreenshotBoundingBox;
  sourceDimensions: ImageDimensions;
}): void {
  const { box, sourceDimensions } = input;
  if (box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0) {
    throw new Error("capture-region requires a positive bounding box inside the source image.");
  }
  if (box.x + box.width > sourceDimensions.width || box.y + box.height > sourceDimensions.height) {
    throw new Error("capture-region bounding box exceeds source image bounds.");
  }
}

export function buildIdentityScaleMapping(input: {
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  sourceCoordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
}): ScreenshotScaleMapping {
  return {
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    sourceStorageRef: input.sourceStorageRef,
    sourceCoordinateSpace: input.sourceCoordinateSpace,
    cropOffsetX: 0,
    cropOffsetY: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

export function buildDerivedScaleMapping(input: {
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  sourceCoordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
  cropOffsetX: number;
  cropOffsetY: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}): ScreenshotScaleMapping {
  return {
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    sourceStorageRef: input.sourceStorageRef,
    sourceCoordinateSpace: input.sourceCoordinateSpace,
    cropOffsetX: input.cropOffsetX,
    cropOffsetY: input.cropOffsetY,
    scaleX: input.outputWidth / input.sourceWidth,
    scaleY: input.outputHeight / input.sourceHeight,
  };
}

export async function cropImageRegion(input: {
  sourceFilePath: string;
  box: ScreenshotBoundingBox;
  outputPath: string;
}): Promise<ImageDimensions> {
  const sourceDimensions = await readImageDimensions(input.sourceFilePath);
  validateBoundingBox({ box: input.box, sourceDimensions });
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await sharp(input.sourceFilePath)
    .extract({
      left: Math.round(input.box.x),
      top: Math.round(input.box.y),
      width: Math.round(input.box.width),
      height: Math.round(input.box.height),
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(input.outputPath);
  return readImageDimensions(input.outputPath);
}

export async function optimizeLosslessPng(input: {
  sourceFilePath: string;
  outputPath: string;
}): Promise<ImageDimensions> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await sharp(input.sourceFilePath)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(input.outputPath);
  return readImageDimensions(input.outputPath);
}

export async function prepareAiInputImage(input: {
  sourceFilePath: string;
  outputPath: string;
  maxDimension: number;
  region?: ScreenshotBoundingBox | null;
}): Promise<{
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  cropOffsetX: number;
  cropOffsetY: number;
}> {
  const sourceDimensions = await readImageDimensions(input.sourceFilePath);
  const box = input.region ?? null;
  if (box) {
    validateBoundingBox({ box, sourceDimensions });
  }

  const extractedWidth = box?.width ?? sourceDimensions.width;
  const extractedHeight = box?.height ?? sourceDimensions.height;
  const longestSide = Math.max(extractedWidth, extractedHeight);
  const resizeRatio = longestSide > input.maxDimension ? input.maxDimension / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(extractedWidth * resizeRatio));
  const targetHeight = Math.max(1, Math.round(extractedHeight * resizeRatio));
  let pipeline = sharp(input.sourceFilePath);
  if (box) {
    pipeline = pipeline.extract({
      left: Math.round(box.x),
      top: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
  }

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await pipeline
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "fill",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(input.outputPath);

  return {
    sourceWidth: extractedWidth,
    sourceHeight: extractedHeight,
    outputWidth: targetWidth,
    outputHeight: targetHeight,
    cropOffsetX: box?.x ?? 0,
    cropOffsetY: box?.y ?? 0,
  };
}