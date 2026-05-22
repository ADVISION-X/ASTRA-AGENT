import type { VideoDownloadAbilityGroup, VideoDownloadResult } from "../../capabilities/video-download/index.js";
import {
  RuntimeFailureClass,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import {
  buildArtifactStageSummary,
  buildPromotedVideoDestinationPath,
  buildPromotedVideoResult,
  buildSuccessfulDownloadStageSummary,
  buildVideoArtifactRef,
  type SuccessfulVideoDownload,
} from "./facebook-product-video-mining.video-support.js";

type DownloadFacebookVideoInput = {
  videoDownload: VideoDownloadAbilityGroup;
  runtimeLogger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  sourcePageUrl: string;
  preferredQuality: "hd" | "sd" | "best_available";
  maxVideoBytes: number;
};

type PromoteFacebookVideoInput = {
  videoDownload: VideoDownloadAbilityGroup;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  missionId: string;
  runId: string;
  roundId: string;
  videoId: string;
  downloaded: VideoDownloadResult;
};

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;
const FACEBOOK_VIDEO_DOWNLOAD_PAYLOAD = {
  recoveryTrail: "facebook-video-download-recovery-trail",
  action: "download_facebook_video",
  beforeHash: "video-download-before",
  afterHash: "video-download-after",
} as const;
const FACEBOOK_ARTIFACT_PAYLOAD = {
  recoveryTrail: "facebook-artifact-recovery-trail",
  beforeHash: "artifact-before",
  afterHash: "artifact-after",
} as const;

const createFacebookRoundTrace = (input: {
  missionId: string;
  runId: string;
  roundId: string;
}) => withRoundTrace({
  context: createMissionTrace({
    missionId: input.missionId,
    runId: input.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  }),
  roundId: input.roundId,
});

const isSuccessfulVideoDownload = (
  downloaded: VideoDownloadResult,
): downloaded is SuccessfulVideoDownload => downloaded.status === "success" && downloaded.output.status === "success";

const buildDownloadExecutionInput = (input: DownloadFacebookVideoInput) => ({
  abilityGroupId: "video-download" as const,
  childCapabilityId: "download-facebook-video-once" as const,
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId,
  capabilityCallId: `${input.roundId}_download`,
  sourcePageUrl: input.sourcePageUrl,
  preferredQuality: input.preferredQuality,
  maxBytes: input.maxVideoBytes,
  timeoutMs: 60_000,
  artifactDisposition: "staging" as const,
});

const buildFailedDownloadStageSummary = (downloaded: VideoDownloadResult) => ({
  reason: downloaded.reviewRequiredReason ?? downloaded.failureReason ?? "facebook_video_download_failed",
  failureClass: RuntimeFailureClass.MEDIA_DOWNLOAD_FAILURE,
  retryable: false,
  terminal: false,
  recoveryPolicy: "review_required" as const,
  durationMs: 0,
  metrics: { byteSize: 0, durationMs: 0 },
  payload: {
    disposition: "staging",
    status: downloaded.status,
    reason: downloaded.reviewRequiredReason ?? downloaded.failureReason ?? "facebook_video_download_failed",
    ...FACEBOOK_VIDEO_DOWNLOAD_PAYLOAD,
  },
});

export const downloadCurrentFacebookVideo = async (input: DownloadFacebookVideoInput): Promise<VideoDownloadResult> => {
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const downloadStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_VIDEO_DOWNLOAD",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    payload: FACEBOOK_VIDEO_DOWNLOAD_PAYLOAD,
  });
  const downloaded = await input.videoDownload.execute(buildDownloadExecutionInput(input));
  if (isSuccessfulVideoDownload(downloaded)) {
    downloadStage.complete(buildSuccessfulDownloadStageSummary(downloaded));
    return downloaded;
  }
  downloadStage.fail(buildFailedDownloadStageSummary(downloaded));
  return downloaded;
};

export const promoteAcceptedFacebookVideo = async (input: PromoteFacebookVideoInput): Promise<VideoDownloadResult | null> => {
  if (!isSuccessfulVideoDownload(input.downloaded)) {
    return null;
  }
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const artifactStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    payload: { artifactFailureClass: RuntimeFailureClass.ARTIFACT_FAILURE },
  });
  const artifactRef = buildVideoArtifactRef(input.downloaded);
  const destinationFilePath = buildPromotedVideoDestinationPath({
    dataDir: input.dataDir,
    missionId: input.missionId,
    runId: input.runId,
    videoId: input.videoId,
    filePath: artifactRef.filePath,
  });
  const artifact = await input.videoDownload.promoteArtifact({
    artifact: artifactRef,
    destinationFilePath,
  });
  artifactStage.complete(buildArtifactStageSummary({
    artifactRef: artifact.artifactRef,
    sha256: artifact.sha256,
    byteSize: input.downloaded.output.byteSize,
    disposition: artifact.artifactDisposition,
    action: "promote_downloaded_video",
    artifactPayload: FACEBOOK_ARTIFACT_PAYLOAD,
  }));
  return buildPromotedVideoResult({ downloaded: input.downloaded, artifact });
};

export const deleteRejectedFacebookVideo = async (input: {
  videoDownload: VideoDownloadAbilityGroup;
  runtimeLogger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  downloaded: VideoDownloadResult;
}): Promise<void> => {
  if (!isSuccessfulVideoDownload(input.downloaded)) {
    return;
  }
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const artifactStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    payload: { artifactFailureClass: RuntimeFailureClass.ARTIFACT_FAILURE },
  });
  const artifactRef = buildVideoArtifactRef(input.downloaded);
  await input.videoDownload.deleteArtifact({
    artifact: artifactRef,
  });
  artifactStage.complete(buildArtifactStageSummary({
    artifactRef: artifactRef.artifactRef,
    sha256: artifactRef.sha256,
    byteSize: input.downloaded.output.byteSize,
    disposition: "deleted",
    action: "delete_downloaded_video",
    artifactPayload: FACEBOOK_ARTIFACT_PAYLOAD,
  }));
};
