import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import type { ImageMetadata, ScreenshotImageProcessingPort } from "../ports/screenshot-image-processing-port.js";
import { SCREENSHOT_IMAGE_PROCESSING_PORT_KIND } from "../shared/screenshot-result.js";

async function ensureTempOutput(extension: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "grasseye-screenshot-"));
  await mkdir(dir, { recursive: true });
  return path.join(dir, `artifact${extension}`);
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return "image/png";
}

export async function inspectImage(filePath: string): Promise<ImageMetadata> {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for ${filePath}.`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    mimeType: detectMimeType(filePath),
  };
}

function createResizePlan(input: { sourceWidth: number; sourceHeight: number; maxAiWidth: number }) {
  const longestSide = Math.max(input.sourceWidth, input.sourceHeight);
  const resizeRatio = longestSide > input.maxAiWidth ? input.maxAiWidth / longestSide : 1;
  return {
    targetWidth: Math.max(1, Math.round(input.sourceWidth * resizeRatio)),
    targetHeight: Math.max(1, Math.round(input.sourceHeight * resizeRatio)),
  };
}

async function cropRegion(portInput: Parameters<ScreenshotImageProcessingPort["cropRegion"]>[0]) {
  const outputFilePath = await ensureTempOutput(".png");
  await sharp(portInput.sourceFilePath)
    .extract({
      left: Math.round(portInput.region.x),
      top: Math.round(portInput.region.y),
      width: Math.round(portInput.region.width),
      height: Math.round(portInput.region.height),
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return { outputFilePath, ...await inspectImage(outputFilePath) };
}

async function optimizeLossless(portInput: Parameters<ScreenshotImageProcessingPort["optimizeLossless"]>[0]) {
  const outputFilePath = await ensureTempOutput(".png");
  await sharp(portInput.sourceFilePath)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return { outputFilePath, equivalence: "dimensions_preserved" as const, ...await inspectImage(outputFilePath) };
}

function createAiInputPipeline(input: Parameters<ScreenshotImageProcessingPort["prepareAiInput"]>[0], targetWidth: number, targetHeight: number) {
  let pipeline = sharp(input.sourceFilePath);
  if (input.region) {
    pipeline = pipeline.extract({
      left: Math.round(input.region.x),
      top: Math.round(input.region.y),
      width: Math.round(input.region.width),
      height: Math.round(input.region.height),
    });
  }
  return pipeline.resize({ width: targetWidth, height: targetHeight, fit: "fill", withoutEnlargement: true });
}

async function prepareAiInput(portInput: Parameters<ScreenshotImageProcessingPort["prepareAiInput"]>[0]) {
  const outputFilePath = await ensureTempOutput(".jpg");
  const sourceMetadata = await inspectImage(portInput.sourceFilePath);
  const sourceWidth = portInput.region?.width ?? sourceMetadata.width;
  const sourceHeight = portInput.region?.height ?? sourceMetadata.height;
  const { targetWidth, targetHeight } = createResizePlan({ sourceWidth, sourceHeight, maxAiWidth: portInput.maxAiWidth });
  await createAiInputPipeline(portInput, targetWidth, targetHeight)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outputFilePath);
  return {
    outputFilePath,
    ...await inspectImage(outputFilePath),
    sourceWidth,
    sourceHeight,
    cropOffsetX: portInput.region?.x ?? 0,
    cropOffsetY: portInput.region?.y ?? 0,
  };
}

export function createSharpScreenshotImageProcessingPort(): ScreenshotImageProcessingPort {
  return {
    portKind: SCREENSHOT_IMAGE_PROCESSING_PORT_KIND,
    inspectImage,
    hashFile,
    cropRegion,
    optimizeLossless,
    prepareAiInput,
  };
}