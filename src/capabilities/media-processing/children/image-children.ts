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
import { prepareMediaProcessingRuntimeDependencies } from "../runtime/runtime-dependencies.js";

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
    const source = await validateMediaSourceFile(input.inputFilePath);
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
    return buildMediaProcessingFailure(
      { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
      "image_processing_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const optimizeImageForWeb: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "optimize-image-for-web-once",
  execute(input, context) {
    return executeImageChild(input, context, runOptimizeImageForWeb);
  },
};

export const resizeImageForWeb: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "resize-image-for-web-once",
  execute(input, context) {
    return executeImageChild(input, context, runResizeImageForWeb);
  },
};

export const generateResponsiveImageSet: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "generate-responsive-image-variants-once",
  execute(input, context) {
    return executeImageChild(input, context, runResponsiveImageSetForWeb);
  },
};
