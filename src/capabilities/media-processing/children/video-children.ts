import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  type ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import type {
  MediaProcessingChildCapability,
  MediaProcessingExecutionContext,
} from "../contract.js";
import {
  isSupportedVideoExtension,
  validateMediaSourceFile,
} from "../runtime/media-source.js";
import {
  buildMediaProcessingFailure,
  buildMediaProcessingSuccess,
} from "../runtime/result.js";
import { prepareMediaProcessingRuntimeDependencies } from "../runtime/runtime-dependencies.js";
import {
  runFfmpegPosterForWeb,
  runFfmpegVideoForWeb,
} from "../runtime/ffmpeg-runner.js";

type VideoMode = "optimized" | "compressed" | "poster";

const executeVideoChild = async (
  input: ParsedMediaProcessingAbilityInput,
  context: MediaProcessingExecutionContext,
  mode: VideoMode,
) => {
  const startedAt = new Date().toISOString();
  let sourceByteSize: number | null = null;
  try {
    const source = await validateMediaSourceFile(input.inputFilePath);
    sourceByteSize = source.byteSize;
    if (!isSupportedVideoExtension(source.extension)) {
      return buildMediaProcessingFailure(
        { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
        "unsupported_video_input",
        "Input file is not a supported web video source.",
        "invalid_input",
      );
    }
    const readiness = await prepareMediaProcessingRuntimeDependencies();
    if (!readiness.video.available || !readiness.video.ffmpegPath) {
      return buildMediaProcessingFailure(
        { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
        readiness.video.reason ?? "ffmpeg_runtime_unavailable",
        "Video processing requires the governed ffmpeg runtime before production transcode can run.",
        "review_required",
      );
    }
    const outputArtifacts = mode === "poster"
      ? await runFfmpegPosterForWeb({
          ffmpegPath: readiness.video.ffmpegPath,
          dataDir: context.dataDir,
          request: input,
          sourceFilePath: source.filePath,
        })
      : await runFfmpegVideoForWeb({
          ffmpegPath: readiness.video.ffmpegPath,
          dataDir: context.dataDir,
          request: input,
          sourceFilePath: source.filePath,
          mode,
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
      "video_processing_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const optimizeVideoForWeb: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "optimize-video-for-web-once",
  execute(input, context) {
    return executeVideoChild(input, context, "optimized");
  },
};

export const compressVideoForWeb: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "compress-video-for-web-once",
  execute(input, context) {
    return executeVideoChild(input, context, "compressed");
  },
};

export const generateVideoPosterForWeb: MediaProcessingChildCapability = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "generate-video-poster-once",
  execute(input, context) {
    return executeVideoChild(input, context, "poster");
  },
};
