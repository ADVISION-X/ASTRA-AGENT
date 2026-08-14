import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadResult,
} from "../schema.js";
import type { RuntimeLogMode } from "../../../lib/runtime-logs/schema.js";
import type { VideoDownloadSubtitleArtifact } from "../type-contracts.js";
import { buildVideoDownloadFailure, buildVideoDownloadSuccess } from "../runtime/result.js";
import { createVideoDownloadAbortHandle } from "../runtime/abort-handle.js";
import { isYoutubePageUrl } from "../runtime/youtube-url.js";
import { downloadYoutubeVideoWithYtDlp } from "../runtime/youtube-dlp-download.js";
import { createRuntimeEvent, createRuntimeLogger, createStageLogger, RuntimeFailureClass, RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";
import { createMissionTrace } from "../../../lib/runtime-logs/trace-context.js";

type ParsedDownloadYoutubeVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

const asFailureStatus = (reviewRequired: boolean): "failed" | "review_required" =>
  reviewRequired ? "review_required" : "failed";

const createYoutubeTrace = (input: ParsedDownloadYoutubeVideoInput) =>
  createMissionTrace({
    missionId: input.missionId,
    runId: input.runId,
    owner: "video-download",
  });

const buildYoutubeDownloadBase = (input: ParsedDownloadYoutubeVideoInput) => ({
  input,
  startedAt: new Date().toISOString(),
});

const safeArtifactTitleSegment = (value: string): string =>
  [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || char === "/" || char === "\\" || char === ":" || char === "*" || char === "?" || char === "\"" || char === "<" || char === ">" || char === "|") {
        return "_";
      }
      return char;
    })
    .join("")
    .split(" ")
    .filter((part) => part.length > 0)
    .join("_")
    .slice(0, 80)
    .trim() || "youtube_video";

const writeArtifact = (
  input: ParsedDownloadYoutubeVideoInput,
  context: VideoDownloadExecutionContext,
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: true },
) => context.artifactStoragePort.importVideoArtifactFromFile({
  missionId: input.missionId,
  runId: input.runId,
  artifactId: `youtube_${safeArtifactTitleSegment(downloaded.displayTitle)}_${randomUUID()}`,
  extension: downloaded.contentType.includes("webm") ? ".webm" : ".mp4",
  sourceFilePath: downloaded.filePath,
  contentType: downloaded.contentType,
  createdAt: new Date().toISOString(),
  artifactDisposition: input.artifactDisposition,
});

const writeSubtitleArtifacts = async (
  input: ParsedDownloadYoutubeVideoInput,
  context: VideoDownloadExecutionContext,
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: true },
): Promise<VideoDownloadSubtitleArtifact[]> => {
  const artifacts: VideoDownloadSubtitleArtifact[] = [];
  for (const [index, subtitle] of downloaded.subtitles.entries()) {
    const artifact = await context.artifactStoragePort.importVideoArtifactFromFile({
      missionId: input.missionId,
      runId: input.runId,
      artifactId: `youtube_subtitle_${subtitle.language}_${index}_${randomUUID()}`,
      extension: subtitle.extension,
      sourceFilePath: subtitle.filePath,
      contentType: subtitle.contentType,
      createdAt: new Date().toISOString(),
      artifactDisposition: input.artifactDisposition,
    });
    artifacts.push({
      artifactRef: artifact.artifactRef,
      storageRef: artifact.storageRef,
      filePath: artifact.filePath,
      sha256: artifact.sha256,
      language: subtitle.language,
      contentType: subtitle.contentType,
      byteSize: subtitle.byteSize,
      sourceKind: subtitle.sourceKind,
    });
  }
  return artifacts;
};

const validateYoutubeSource = (
  input: ParsedDownloadYoutubeVideoInput,
  base: ReturnType<typeof buildYoutubeDownloadBase>,
): VideoDownloadResult | null => {
  if (isYoutubePageUrl(input.sourcePageUrl)) {
    return null;
  }
  return buildVideoDownloadFailure(
    base,
    "source_page_mismatch",
    "YouTube download child requires a YouTube source page URL.",
    "invalid_input",
  );
};

const persistYoutubeArtifacts = async (input: {
  request: ParsedDownloadYoutubeVideoInput;
  context: VideoDownloadExecutionContext;
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: true };
}) => ({
  artifact: await writeArtifact(input.request, input.context, input.downloaded),
  subtitleArtifacts: await writeSubtitleArtifacts(input.request, input.context, input.downloaded),
});

const buildYoutubeDownloadSuccess = (
  base: ReturnType<typeof buildYoutubeDownloadBase>,
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: true },
  persisted: Awaited<ReturnType<typeof persistYoutubeArtifacts>>,
): VideoDownloadResult => buildVideoDownloadSuccess({
  ...base,
  candidateHost: "youtube.com",
  contentType: downloaded.contentType,
  byteSize: downloaded.byteSize,
  durationMs: downloaded.durationMs,
  width: downloaded.width,
  height: downloaded.height,
  selectedQuality: downloaded.selectedQuality,
  candidateKind: "media_resource",
  sourceTitle: downloaded.sourceTitle,
  displayTitle: downloaded.displayTitle,
  artifactRef: persisted.artifact.artifactRef,
  storageRef: persisted.artifact.storageRef,
  filePath: persisted.artifact.filePath,
  sha256: persisted.artifact.sha256,
  artifactDisposition: persisted.artifact.artifactDisposition,
  subtitleArtifacts: persisted.subtitleArtifacts,
  videoId: downloaded.videoId,
});

const emitYoutubeProgress = (input: {
  request: ParsedDownloadYoutubeVideoInput;
  context: VideoDownloadExecutionContext;
  startedAt: number;
  message: string;
}): void => {
  const message = input.message.trim();
  const isRetryOrError = message.toLowerCase().split("error").length > 1 || message.toLowerCase().split("retry").length > 1;
  const isMetadataResolved = message.split("metadata resolved").length > 1;
  const isProgress = message.split("[download]").length > 1;
  let eventType: RuntimeLogEventType = RuntimeLogEventType.ARTIFACT_OPERATION_STARTED;
  if (isRetryOrError) {
    eventType = RuntimeLogEventType.ARTIFACT_OPERATION_FAILED;
  } else if (isMetadataResolved) {
    eventType = RuntimeLogEventType.ARTIFACT_OPERATION_COMPLETED;
  }
  input.context.runtimeLogger?.emit(createRuntimeEvent({
    context: createYoutubeTrace(input.request),
    eventType,
    level: isRetryOrError ? "warn" : "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    status: isRetryOrError ? "failed" : isMetadataResolved ? "success" : "started",
    reason: isRetryOrError ? "youtube_download_retryable_runtime_error" : "youtube_download_progress",
    preview: {
      message,
      phase: isProgress ? "download_progress" : isMetadataResolved ? "metadata_resolved" : "metadata_or_download",
    },
    metrics: { elapsedMs: Date.now() - input.startedAt },
    payload: {
      progressName: "YOUTUBE_DLP_PROGRESS",
      childCapabilityId: "download-youtube-video-once",
      progressPhase: isProgress ? "download_progress" : isMetadataResolved ? "metadata_resolved" : "metadata_or_download",
    },
  }));
};

const failYoutubeStageForSource = (
  youtubeStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>,
  sourceFailure: VideoDownloadResult,
): void => {
  youtubeStage.fail({
    reason: sourceFailure.failureReason ?? "source_page_mismatch",
    failureClass: RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE,
    retryable: false,
    terminal: true,
    recoveryPolicy: "terminal",
  });
};

const buildAndLogYoutubeFailure = (input: {
  base: ReturnType<typeof buildYoutubeDownloadBase>;
  youtubeStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>;
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: false };
}): VideoDownloadResult => {
  const failed = buildVideoDownloadFailure(
    input.base,
    input.downloaded.failureReason,
    input.downloaded.reason,
    asFailureStatus(input.downloaded.reviewRequired),
  );
  const terminalInput = {
    reason: failed.failureReason ?? "candidate_not_video",
    failureClass: RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE,
    retryable: false,
    terminal: true,
    recoveryPolicy: input.downloaded.reviewRequired ? "review_required" : "terminal",
    durationMs: failed.runtimeProof.durationMsTotal,
    metrics: { durationMs: failed.runtimeProof.durationMsTotal },
  };
  if (input.downloaded.reviewRequired) {
    input.youtubeStage.reviewRequired({
      ...terminalInput,
      ...(failed.reviewRequiredReason ? { actionableMessage: failed.reviewRequiredReason } : {}),
    });
  } else {
    input.youtubeStage.fail({ ...terminalInput, recoveryPolicy: "terminal" });
  }
  return failed;
};

const completeYoutubeStage = (
  youtubeStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>,
  success: VideoDownloadResult,
): void => {
  youtubeStage.complete({
    durationMs: success.runtimeProof.durationMsTotal,
    ...(success.runtimeProof.artifactRef ? { refs: { artifactRef: success.runtimeProof.artifactRef } } : {}),
    metrics: {
      durationMs: success.runtimeProof.durationMsTotal,
      byteSize: success.runtimeProof.byteSize ?? 0,
    },
    preview: {
      selectedQuality: success.runtimeProof.selectedQuality,
      displayTitle: success.runtimeProof.displayTitle ?? "unknown",
      contentType: success.runtimeProof.contentType ?? "unknown",
      candidateKind: success.runtimeProof.candidateKind ?? "unknown",
    },
  });
};

async function executeDownloadYoutubeVideoOnce(
  input: ParsedDownloadYoutubeVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = buildYoutubeDownloadBase(input);
  const stageLogger = createStageLogger({
    logger: context.runtimeLogger ?? createRuntimeLogger({ terminalEnabled: false }),
  });
  const youtubeStage = stageLogger.start({
    context: createYoutubeTrace(input),
    stageName: "YOUTUBE_VIDEO_DOWNLOAD",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"] satisfies RuntimeLogMode[],
    metrics: { timeoutMs: input.timeoutMs },
    preview: {
      videoId: new URL(input.sourcePageUrl).searchParams.get("v") ?? "unknown",
      selectedQuality: input.preferredQuality,
      subtitles: input.downloadSubtitles ? "requested" : "not_requested",
    },
    payload: {
      abilityGroupId: input.abilityGroupId,
      childCapabilityId: input.childCapabilityId,
      capabilityCallId: input.capabilityCallId,
      platformId: "youtube-web",
    },
  });
  const sourceFailure = validateYoutubeSource(input, base);
  if (sourceFailure) {
    failYoutubeStageForSource(youtubeStage, sourceFailure);
    return sourceFailure;
  }
  const abortHandle = createVideoDownloadAbortHandle(input.timeoutMs, context.abortSignal);
  try {
    const downloaded = await downloadYoutubeVideoWithYtDlp(input, abortHandle.signal, (message) => {
      emitYoutubeProgress({ request: input, context, startedAt: youtubeStage.startedAt, message });
    });
    if (!downloaded.ok) {
      return buildAndLogYoutubeFailure({ base, youtubeStage, downloaded });
    }
    const persisted = await persistYoutubeArtifacts({ request: input, context, downloaded })
      .finally(() => rm(downloaded.tempDir, { recursive: true, force: true }));
    const success = buildYoutubeDownloadSuccess(base, downloaded, persisted);
    completeYoutubeStage(youtubeStage, success);
    return success;
  } finally {
    abortHandle.dispose();
  }
}

export const downloadYoutubeVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-youtube-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadYoutubeVideoOnce(input as ParsedDownloadYoutubeVideoInput, context),
};
