import path from "node:path";

import type { Sharp } from "sharp";

import type {
  MediaProcessingArtifact,
  ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import {
  buildMediaProcessingArtifact,
  ensureMediaProcessingRunDir,
} from "./artifact-storage.js";

type ImageOutputPlan = {
  outputFileName: string;
  derivativeKind: MediaProcessingArtifact["derivativeKind"];
  width: number | null;
  height: number | null;
};

const contentTypeForImageFormat = (format: string): string => {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
};

const imagePipelineForFormat = (
  pipeline: Sharp,
  format: string,
  quality: number,
): Sharp => {
  if (format === "jpeg") {
    return pipeline.jpeg({ quality, mozjpeg: true });
  }
  if (format === "png") {
    return pipeline.png({ quality });
  }
  return pipeline.webp({ quality });
};

const loadSharp = async () => (await import("sharp")).default;

const runSingleImageOutput = async (input: {
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
  plan: ImageOutputPlan;
  format: string;
}): Promise<MediaProcessingArtifact> => {
  const sharp = await loadSharp();
  const runDir = await ensureMediaProcessingRunDir(input.dataDir, input.request);
  const outputPath = path.join(runDir, input.plan.outputFileName);
  let pipeline = sharp(input.sourceFilePath).rotate();
  if (input.plan.width || input.plan.height) {
    const fixedHero = input.request.presetId === "public-knowledge-hero";
    pipeline = pipeline.resize({
      width: input.plan.width ?? undefined,
      height: input.plan.height ?? undefined,
      fit: fixedHero ? "contain" : "inside",
      ...(fixedHero ? { background: { r: 238, g: 234, b: 224, alpha: 1 } } : {}),
      withoutEnlargement: !fixedHero,
    });
  }
  await imagePipelineForFormat(pipeline, input.format, input.request.quality).toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  return buildMediaProcessingArtifact({
    input: input.request,
    filePath: outputPath,
    contentType: contentTypeForImageFormat(input.format),
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: input.format,
    derivativeKind: input.plan.derivativeKind,
  });
};

export const runOptimizeImageForWeb = async (input: {
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
}): Promise<MediaProcessingArtifact[]> => {
  const format = input.request.outputFormat;
  const plan: ImageOutputPlan = {
    outputFileName: `optimized.${format}`,
    derivativeKind: "optimized",
    width: input.request.maxWidth ?? null,
    height: input.request.maxHeight ?? null,
  };
  return [await runSingleImageOutput({ ...input, plan, format })];
};

export const runResizeImageForWeb = async (input: {
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
}): Promise<MediaProcessingArtifact[]> => {
  const format = input.request.outputFormat;
  const plan: ImageOutputPlan = {
    outputFileName: `resized.${format}`,
    derivativeKind: "resized",
    width: input.request.targetWidth ?? input.request.maxWidth ?? null,
    height: input.request.targetHeight ?? input.request.maxHeight ?? null,
  };
  return [await runSingleImageOutput({ ...input, plan, format })];
};

export const runResponsiveImageSetForWeb = async (input: {
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
}): Promise<MediaProcessingArtifact[]> => {
  const sharp = await loadSharp();
  const metadata = await sharp(input.sourceFilePath).metadata();
  const sourceWidth = metadata.width ?? 1280;
  const requestedWidths = input.request.variantWidths ?? [320, 640, 960, 1280];
  const widths = [...new Set(requestedWidths)]
    .filter((width) => width <= sourceWidth)
    .slice(0, 8);
  const usableWidths = widths.length > 0 ? widths : [Math.min(sourceWidth, 1280)];
  const format = input.request.outputFormat;
  const artifacts: MediaProcessingArtifact[] = [];
  for (const width of usableWidths) {
    artifacts.push(await runSingleImageOutput({
      ...input,
      format,
      plan: {
        outputFileName: `responsive-${width}.${format}`,
        derivativeKind: "responsive_variant",
        width,
        height: null,
      },
    }));
  }
  return artifacts;
};
