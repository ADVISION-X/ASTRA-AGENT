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
  const allowedRoots = [
    path.join(context.dataDir, "runtime-data", "media-processing-uploads"),
    path.join(context.dataDir, "runtime-data", "media-processing-artifacts"),
  ];
  try {
    const source = await validateMediaSourceFile(input.inputFilePath, allowedRoots);
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
    if (!readiness.video.available || !readiness.video.ffmpegPath || !readiness.video.ffprobePath) {
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
          ffprobePath: readiness.video.ffprobePath,
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
    const reason = error instanceof Error ? error.message : String(error);
    return buildMediaProcessingFailure(
      { input, dataDir: context.dataDir, startedAt, inputByteSize: sourceByteSize },
      reason === "media_input_outside_allowed_roots" ? "media_input_outside_allowed_roots" : "video_processing_failed",
      reason,
      reason === "media_input_outside_allowed_roots" ? "invalid_input" : "failed",
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
