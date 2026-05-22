import { judgeFacebookProductVideo } from "./facebook-product-video-mining.ai-judge.js";
import { collectAllLoadableComments } from "./facebook-product-video-mining.comments.js";
import { navigateToNextFacebookVideo, type FacebookMiningRoundOutcome } from "./facebook-product-video-mining.navigation.js";
import {
  handleDownloadFailure,
  handleJudgmentFailure,
} from "./facebook-product-video-mining.round-outcomes.js";
import {
  saveRoundCandidateEvidence,
} from "./facebook-product-video-mining.outcome-support.js";
import {
  FacebookMiningRoundRuntime,
  type FacebookMiningRoundArtifacts,
  type FacebookMiningRoundContext,
  type FacebookMiningRoundResolution,
  type FacebookMiningRoundStageResult,
} from "./facebook-product-video-mining.round-runtime.js";
import {
  deleteRejectedFacebookVideo,
  downloadCurrentFacebookVideo,
} from "./facebook-product-video-mining.video.js";

type FacebookMiningArtifactCollectionInput = FacebookMiningRoundContext & {
  probe: FacebookMiningRoundArtifacts["probe"];
  downloadCurrentFacebookVideo: typeof downloadCurrentFacebookVideo;
};

type FacebookMiningRoundComments = Awaited<ReturnType<typeof collectAllLoadableComments>>;

const buildDownloadFailureContract = (input: FacebookMiningArtifactCollectionInput & {
  download: Awaited<ReturnType<typeof downloadCurrentFacebookVideo>>;
}) => ({
  failureClass: "MEDIA_DOWNLOAD_FAILURE",
  recoveryPolicy: "navigate_next",
  recoveryTrail: "facebook-round-recovery-trail",
  action: "navigate_next_video",
  beforeHash: input.probe.facebookVideoId ?? input.round.roundId,
  afterHash: "next-video-pending",
  durationMs: 0,
  terminal: false,
  reason: input.download.failureReason,
} as const);

const buildJudgmentFailureContract = (input: FacebookMiningRoundContext & {
  artifacts: FacebookMiningRoundArtifacts;
  judgment: Awaited<ReturnType<typeof judgeFacebookProductVideo>>;
}) => ({
  failureClass: "AI_PARSE_FAILURE",
  recoveryPolicy: "review_required",
  recoveryTrail: "facebook-round-recovery-trail",
  action: "record_judgment_failure",
  beforeHash: input.artifacts.probe.facebookVideoId ?? input.round.roundId,
  afterHash: "judgment-review-required",
  durationMs: 0,
  terminal: true,
  reason: input.judgment.reason,
} as const);

const saveDuplicateDownloadedCandidate = (input: FacebookMiningArtifactCollectionInput & {
  comments: FacebookMiningRoundComments;
  download: FacebookMiningRoundArtifacts["download"];
}): void => {
  saveRoundCandidateEvidence({
    storage: input.input.storage,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    roundIndex: input.input.roundIndex,
    probe: input.probe,
    comments: input.comments.comments,
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: "duplicate_video_artifact",
    status: "failed",
  });
};

const collectFacebookMiningArtifacts = async (input: FacebookMiningArtifactCollectionInput): Promise<{
  comments: FacebookMiningRoundComments;
  download: Awaited<ReturnType<typeof downloadCurrentFacebookVideo>>;
}> => {
  const comments = await collectAllLoadableComments({
    browser: input.input.browser,
    runtimeLogger: input.input.runtimeLogger,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    probe: input.probe,
    maxCommentScrolls: input.input.run.maxCommentScrolls,
    maxCommentWaitMs: input.input.run.maxCommentWaitMs,
  });
  const download = await input.downloadCurrentFacebookVideo({
    videoDownload: input.input.videoDownload,
    runtimeLogger: input.input.runtimeLogger,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    sourcePageUrl: input.probe.sourcePageUrl,
    preferredQuality: input.input.run.preferredQuality,
    maxVideoBytes: input.input.run.maxVideoBytes,
  });
  return { comments, download };
};

const requireSuccessfulDownload = async (input: FacebookMiningArtifactCollectionInput & {
  comments: FacebookMiningRoundComments;
  download: Awaited<ReturnType<typeof downloadCurrentFacebookVideo>>;
}): Promise<FacebookMiningRoundStageResult<FacebookMiningRoundArtifacts["download"]>> => {
  if (!FacebookMiningRoundRuntime.isSuccessfulVideoDownload(input.download)) {
    return FacebookMiningRoundRuntime.stopFacebookMiningRound(await handleDownloadFailure({
      browser: input.input.browser,
      runtimeLogger: input.input.runtimeLogger,
      storage: input.input.storage,
      feedEntryUrl: input.input.run.feedEntryUrl,
      missionId: input.input.run.missionId,
      runId: input.input.run.runId,
      roundId: input.round.roundId,
      roundIndex: input.input.roundIndex,
      probe: input.probe,
      comments: input.comments,
      download: input.download,
      failureContract: buildDownloadFailureContract(input),
    }));
  }
  return FacebookMiningRoundRuntime.continueFacebookMiningRound(input.download);
};

const hasDuplicateSavedVideo = (input: {
  context: FacebookMiningRoundContext;
  download: FacebookMiningRoundArtifacts["download"];
}): boolean => input.context.input.storage.listCandidates(input.context.input.run.runId).some((candidate) =>
  candidate.videoSha256 === input.download.output.sha256 && candidate.status === "saved");

const handleDuplicateDownloadedVideo = async (input: FacebookMiningArtifactCollectionInput & {
  comments: FacebookMiningRoundComments;
  download: FacebookMiningRoundArtifacts["download"];
}): Promise<FacebookMiningRoundStageResult<never> | null> => {
  if (!hasDuplicateSavedVideo({ context: input, download: input.download })) {
    return null;
  }
  await deleteRejectedFacebookVideo({
    videoDownload: input.input.videoDownload,
    runtimeLogger: input.input.runtimeLogger,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    downloaded: input.download,
  });
  saveDuplicateDownloadedCandidate(input);
  return FacebookMiningRoundRuntime.stopFacebookMiningRound(await navigateToNextFacebookVideo({
    browser: input.input.browser,
    logger: input.input.runtimeLogger,
    runId: input.input.run.runId,
    missionId: input.input.run.missionId,
    roundId: input.round.roundId,
    feedEntryUrl: input.input.run.feedEntryUrl,
  }));
};

export const downloadFacebookMiningRoundArtifacts = async (
  input: FacebookMiningArtifactCollectionInput,
): Promise<FacebookMiningRoundStageResult<FacebookMiningRoundArtifacts>> => {
  const { comments, download } = await collectFacebookMiningArtifacts(input);
  const successfulDownload = await requireSuccessfulDownload({
    ...input,
    comments,
    download,
  });
  if (!successfulDownload.ok) {
    return successfulDownload;
  }
  const duplicateDownload = await handleDuplicateDownloadedVideo({
    ...input,
    comments,
    download: successfulDownload.value,
  });
  if (duplicateDownload) {
    return duplicateDownload;
  }
  return FacebookMiningRoundRuntime.continueFacebookMiningRound({
    probe: input.probe,
    comments,
    download: successfulDownload.value,
  });
};

export const judgeFacebookMiningRound = async (input: FacebookMiningRoundContext & {
  artifacts: FacebookMiningRoundArtifacts;
  judgeFacebookProductVideo: typeof judgeFacebookProductVideo;
  timeoutMs: number;
}): Promise<FacebookMiningRoundStageResult<FacebookMiningRoundResolution>> => {
  const judgment = await input.judgeFacebookProductVideo({
    aiInputGateway: input.input.aiInputGateway,
    runtimeLogger: input.input.runtimeLogger,
    providerKind: input.input.run.providerKind,
    modelName: input.input.run.modelName ?? null,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    probe: input.artifacts.probe,
    comments: input.artifacts.comments.comments,
    videoFilePath: input.artifacts.download.output.filePath,
    timeoutMs: input.timeoutMs,
    maxFileBytes: input.input.run.maxVideoBytes,
  });
  if (judgment.status !== "success") {
    return FacebookMiningRoundRuntime.stopFacebookMiningRound(await handleJudgmentFailure({
      browser: input.input.browser,
      runtimeLogger: input.input.runtimeLogger,
      videoDownload: input.input.videoDownload,
      storage: input.input.storage,
      feedEntryUrl: input.input.run.feedEntryUrl,
      missionId: input.input.run.missionId,
      runId: input.input.run.runId,
      roundId: input.round.roundId,
      roundIndex: input.input.roundIndex,
      probe: input.artifacts.probe,
      comments: input.artifacts.comments,
      download: input.artifacts.download,
      judgment,
      failureContract: buildJudgmentFailureContract({
        ...input,
        judgment,
      }),
    }));
  }
  return FacebookMiningRoundRuntime.continueFacebookMiningRound({ ...input.artifacts, judgment });
};
