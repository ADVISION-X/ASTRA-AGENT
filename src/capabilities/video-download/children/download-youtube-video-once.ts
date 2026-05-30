import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadResult,
} from "../schema.js";
import type { RuntimeLogMode } from "../../../lib/runtime-logs/schema.js";
import type { VideoDownloadSubtitleArtifact } from "../type-contracts.js";
import { buildVideoDownloadFailure, buildVideoDownloadSuccess } from "../runtime/result.js";
import { isYoutubePageUrl } from "../runtime/youtube-url.js";
import { downloadYoutubeVideoWithYtDlp } from "../runtime/youtube-dlp-download.js";
import { createRuntimeLogger, createStageLogger, RuntimeFailureClass } from "../../../lib/runtime-logs/index.js";
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

const writeArtifact = (
  input: ParsedDownloadYoutubeVideoInput,
  context: VideoDownloadExecutionContext,
  downloaded: Awaited<ReturnType<typeof downloadYoutubeVideoWithYtDlp>> & { ok: true },
) => context.artifactStoragePort.writeVideoArtifact({
  missionId: input.missionId,
  runId: input.runId,
  artifactId: `youtube_${Date.now()}`,
  extension: downloaded.contentType.includes("webm") ? ".webm" : ".mp4",
  bytes: downloaded.bytes,
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
    const artifact = await context.artifactStoragePort.writeVideoArtifact({
      missionId: input.missionId,
      runId: input.runId,
      artifactId: `youtube_subtitle_${subtitle.language}_${index}_${Date.now()}`,
      extension: subtitle.extension,
      bytes: subtitle.bytes,
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

const createYoutubeAbortHandle = (timeoutMs: number) => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  return {
    abortController,
    dispose(): void {
      clearTimeout(timeout);
    },
  };
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
  artifactRef: persisted.artifact.artifactRef,
  storageRef: persisted.artifact.storageRef,
  filePath: persisted.artifact.filePath,
  sha256: persisted.artifact.sha256,
  artifactDisposition: persisted.artifact.artifactDisposition,
  subtitleArtifacts: persisted.subtitleArtifacts,
  videoId: downloaded.videoId,
});

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
    metrics: { maxBytes: input.maxBytes, timeoutMs: input.timeoutMs },
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
    youtubeStage.fail({ reason: sourceFailure.failureReason ?? "source_page_mismatch", failureClass: RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE, retryable: false, terminal: true, recoveryPolicy: "terminal" });
    return sourceFailure;
  }
  const abortHandle = createYoutubeAbortHandle(input.timeoutMs);
  try {
    const downloaded = await downloadYoutubeVideoWithYtDlp(input, abortHandle.abortController.signal);
    if (!downloaded.ok) {
      const failed = buildVideoDownloadFailure(
        base,
        downloaded.reviewRequired ? "permission_denied" : "candidate_not_video",
        downloaded.reason,
        asFailureStatus(downloaded.reviewRequired),
      );
      const terminalInput = {
        reason: failed.failureReason ?? "candidate_not_video",
        failureClass: RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE,
        retryable: false,
        terminal: true,
        recoveryPolicy: downloaded.reviewRequired ? "review_required" : "terminal",
        durationMs: failed.runtimeProof.durationMsTotal,
        metrics: { durationMs: failed.runtimeProof.durationMsTotal },
      };
      if (downloaded.reviewRequired) {
        youtubeStage.reviewRequired({ ...terminalInput, ...(failed.reviewRequiredReason ? { actionableMessage: failed.reviewRequiredReason } : {}) });
      } else {
        youtubeStage.fail({ ...terminalInput, recoveryPolicy: "terminal" });
      }
      return failed;
    }
    const success = buildYoutubeDownloadSuccess(base, downloaded, await persistYoutubeArtifacts({ request: input, context, downloaded }));
    youtubeStage.complete({
      durationMs: success.runtimeProof.durationMsTotal,
      ...(success.runtimeProof.artifactRef ? { refs: { artifactRef: success.runtimeProof.artifactRef } } : {}),
      metrics: { durationMs: success.runtimeProof.durationMsTotal, byteSize: success.runtimeProof.byteSize ?? 0 },
      preview: {
        selectedQuality: success.runtimeProof.selectedQuality,
        contentType: success.runtimeProof.contentType ?? "unknown",
      },
    });
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
