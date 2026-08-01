import path from "node:path";

import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  type ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import type {
  MediaProcessingChildCapability,
  MediaProcessingExecutionContext,
} from "../contract.js";
import {
  isSupportedImageExtension,
  validateMediaSourceFile,
} from "../runtime/media-source.js";
import {
  buildMediaProcessingFailure,
  buildMediaProcessingSuccess,
} from "../runtime/result.js";
import {
  runOptimizeImageForWeb,
  runResizeImageForWeb,
  runResponsiveImageSetForWeb,
} from "../runtime/sharp-runner.js";
import { buildMediaProcessingArtifact } from "../runtime/artifact-storage.js";
import { inspectPublicKnowledgeImageRedlines } from "../runtime/image-redline-observer.js";
import { prepareMediaProcessingRuntimeDependencies } from "../dependency-readiness.js";

type ImageRunner = (input: {
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
}) => ReturnType<typeof runOptimizeImageForWeb>;

const executeImageChild = async (
  input: ParsedMediaProcessingAbilityInput,
  context: MediaProcessingExecutionContext,
  runner: ImageRunner,
) => {
  const startedAt = new Date().toISOString();
  let sourceByteSize: number | null = null;
  const allowedRoots = [
    path.join(context.dataDir, "runtime-data", "media-processing-uploads"),
    path.join(context.dataDir, "runtime-data", "media-processing-artifacts"),
    path.join(context.dataDir, "runtime-data", "ai-input-gateway", "generated-images"),
  ];
  try {
    const readiness = await prepareMediaProcessingRuntimeDependencies();
    if (!readiness.image.available) {
      return buildMediaProcessingFailure(
        { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
        readiness.image.reason ?? "sharp_runtime_unavailable",
        "Image processing runtime is unavailable.",
        "review_required",
      );
    }
    const source = await validateMediaSourceFile(input.inputFilePath, allowedRoots);
    sourceByteSize = source.byteSize;
    if (!isSupportedImageExtension(source.extension)) {
      return buildMediaProcessingFailure(
        { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
        "unsupported_image_input",
        "Input file is not a supported web image source.",
        "invalid_input",
      );
    }
    const outputArtifacts = await runner({
      dataDir: context.dataDir,
      request: input,
      sourceFilePath: source.filePath,
    });
    return buildMediaProcessingSuccess({
      input,
      dataDir: context.dataDir,
      startedAt,
      inputByteSize: sourceByteSize,
      outputArtifacts,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildMediaProcessingFailure(
      { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
      reason === "media_input_outside_allowed_roots" ? "media_input_outside_allowed_roots" : "image_processing_failed",
      reason,
      reason === "media_input_outside_allowed_roots" ? "invalid_input" : "failed",
    );
  }
};

export const createOptimizeImageForWeb = (): MediaProcessingChildCapability => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "optimize-image-for-web-once",
  execute(input, context) {
    return executeImageChild(input, context, runOptimizeImageForWeb);
  },
});

export const createResizeImageForWeb = (): MediaProcessingChildCapability => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "resize-image-for-web-once",
  execute(input, context) {
    return executeImageChild(input, context, runResizeImageForWeb);
  },
});

export const createGenerateResponsiveImageSet = (): MediaProcessingChildCapability => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "generate-responsive-image-variants-once",
  execute(input, context) {
    return executeImageChild(input, context, runResponsiveImageSetForWeb);
  },
});

export const createInspectPublicKnowledgeImageRedlines = (): MediaProcessingChildCapability => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "inspect-public-knowledge-image-redlines-once",
  async execute(input, context) {
    const startedAt = new Date().toISOString();
    let sourceByteSize: number | null = null;
    try {
      const source = await validateMediaSourceFile(input.inputFilePath, [
        path.join(context.dataDir, "runtime-data", "media-processing-artifacts"),
      ]);
      sourceByteSize = source.byteSize;
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(source.filePath).metadata();
      if (
        metadata.format !== "webp"
        || metadata.width !== 1200
        || metadata.height !== 630
        || metadata.hasAlpha === true
        || metadata.exif !== undefined
        || metadata.icc !== undefined
        || metadata.iptc !== undefined
        || metadata.xmp !== undefined
      ) {
        return buildMediaProcessingFailure(
          { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
          "public_knowledge_image_binary_contract_invalid",
          "Image must decode as opaque metadata-free 1200x630 WebP.",
          "review_required",
        );
      }
      const artifact = await buildMediaProcessingArtifact({
        input,
        filePath: source.filePath,
        contentType: "image/webp",
        width: 1200,
        height: 630,
        durationMs: null,
        format: "webp",
        sourceByteSize,
        derivativeKind: "inspection",
      });
      const observation = await inspectPublicKnowledgeImageRedlines(source.filePath);
      if (observation.status !== "passed") {
        return buildMediaProcessingFailure(
          { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize, outputArtifacts: [artifact] },
          "public_knowledge_image_redline",
          observation.reason ?? "Image redline inspection was uncertain.",
          "review_required",
        );
      }
      return buildMediaProcessingSuccess({
        input,
        dataDir: context.dataDir,
        startedAt,
        inputByteSize: sourceByteSize,
        outputArtifacts: [artifact],
      });
    } catch (error) {
      return buildMediaProcessingFailure(
        { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
        "public_knowledge_image_redline_unavailable",
        error instanceof Error ? error.message : String(error),
        "review_required",
      );
    }
  },
});
