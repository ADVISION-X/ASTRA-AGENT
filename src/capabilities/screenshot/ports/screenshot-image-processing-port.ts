import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { ScreenshotBoundingBoxSchema } from "../schema.js";
import { SCREENSHOT_IMAGE_PROCESSING_PORT_KIND } from "../shared/screenshot-result.js";

type ImageMetadata = {
  width: number;
  height: number;
  mimeType: string;
};

export interface ScreenshotImageProcessingPort {
  readonly portKind: "sharp-screenshot-image-processing-port";
  inspectImage(filePath: string): Promise<ImageMetadata>;
  hashFile(filePath: string): Promise<string>;
  cropRegion(input: { sourceFilePath: string; region: ReturnType<typeof ScreenshotBoundingBoxSchema.parse> }): Promise<ImageMetadata & { outputFilePath: string }>;
  optimizeLossless(input: { sourceFilePath: string }): Promise<ImageMetadata & { outputFilePath: string; equivalence: "dimensions_preserved" }>;
  prepareAiInput(input: { sourceFilePath: string; region: ReturnType<typeof ScreenshotBoundingBoxSchema.parse> | null; maxAiWidth: number }): Promise<ImageMetadata & {
    outputFilePath: string;
    sourceWidth: number;
    sourceHeight: number;
    cropOffsetX: number;
    cropOffsetY: number;
  }>;
}

async function ensureTempOutput(extension: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "grasseye-screenshot-"));
  await mkdir(dir, { recursive: true });
  return path.join(dir, `artifact${extension}`);
}

function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return "image/png";
}

async function inspectImage(filePath: string): Promise<ImageMetadata> {
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

export function createSharpScreenshotImageProcessingPort(): ScreenshotImageProcessingPort {
  return {
    portKind: SCREENSHOT_IMAGE_PROCESSING_PORT_KIND,
    inspectImage,
    async hashFile(filePath) {
      const content = await readFile(filePath);
      return createHash("sha256").update(content).digest("hex");
    },
    async cropRegion(input) {
      const outputFilePath = await ensureTempOutput(".png");
      await sharp(input.sourceFilePath)
        .extract({
          left: Math.round(input.region.x),
          top: Math.round(input.region.y),
          width: Math.round(input.region.width),
          height: Math.round(input.region.height),
        })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outputFilePath);
      return {
        outputFilePath,
        ...await inspectImage(outputFilePath),
      };
    },
    async optimizeLossless(input) {
      const outputFilePath = await ensureTempOutput(".png");
      await sharp(input.sourceFilePath)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outputFilePath);
      return {
        outputFilePath,
        equivalence: "dimensions_preserved",
        ...await inspectImage(outputFilePath),
      };
    },
    async prepareAiInput(input) {
      const outputFilePath = await ensureTempOutput(".jpg");
      const sourceMetadata = await inspectImage(input.sourceFilePath);
      const region = input.region;
      const extractedWidth = region ? region.width : sourceMetadata.width;
      const extractedHeight = region ? region.height : sourceMetadata.height;
      const longestSide = Math.max(extractedWidth, extractedHeight);
      const resizeRatio = longestSide > input.maxAiWidth ? input.maxAiWidth / longestSide : 1;
      const targetWidth = Math.max(1, Math.round(extractedWidth * resizeRatio));
      const targetHeight = Math.max(1, Math.round(extractedHeight * resizeRatio));
      let pipeline = sharp(input.sourceFilePath);
      if (region) {
        pipeline = pipeline.extract({
          left: Math.round(region.x),
          top: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        });
      }
      await pipeline
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: "fill",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(outputFilePath);

      return {
        outputFilePath,
        ...await inspectImage(outputFilePath),
        sourceWidth: extractedWidth,
        sourceHeight: extractedHeight,
        cropOffsetX: region?.x ?? 0,
        cropOffsetY: region?.y ?? 0,
      };
    },
  };
}
