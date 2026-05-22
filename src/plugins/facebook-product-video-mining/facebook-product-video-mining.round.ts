import { buildFacebookMiningRoundState } from "./facebook-product-video-mining.result.js";
import { judgeFacebookProductVideo } from "./facebook-product-video-mining.ai-judge.js";
import {
  collectAllLoadableComments,
} from "./facebook-product-video-mining.comments.js";
import type { FacebookMiningRoundOutcome } from "./facebook-product-video-mining.navigation.js";
import {
  downloadCurrentFacebookVideo,
} from "./facebook-product-video-mining.video.js";
import {
  handleDownloadFailure,
  handleJudgmentFailure,
} from "./facebook-product-video-mining.round-outcomes.js";
import {
  FacebookMiningRoundRuntime,
  type FacebookMiningRoundArtifacts,
  type FacebookMiningRoundContext,
  type FacebookMiningRoundInput,
  type FacebookMiningRoundResolution,
  type FacebookMiningRoundStageResult,
} from "./facebook-product-video-mining.round-runtime.js";
import {
  buildFacebookMiningCandidate,
  saveFacebookMiningCandidateEvidence,
} from "./facebook-product-video-mining.candidate-record.js";
import { navigateToNextFacebookVideo } from "./facebook-product-video-mining.navigation.js";
import { deleteRejectedFacebookVideo } from "./facebook-product-video-mining.video.js";

type FacebookMiningArtifactCollectionInput = FacebookMiningRoundContext & {
  probe: FacebookMiningRoundArtifacts["probe"];
};

type FacebookMiningRoundComments = Awaited<ReturnType<typeof collectAllLoadableComments>>;

const collectFacebookMiningArtifacts = async (input: FacebookMiningArtifactCollectionInput): Promise<{
  comments: FacebookMiningRoundComments;
  download: Awaited<ReturnType<typeof downloadCurrentFacebookVideo>>;
}> => {
  const comments = await collectAllLoadableComments({
    browser: input.input.browser,
    probe: input.probe,
    maxCommentScrolls: input.input.run.maxCommentScrolls,
    maxCommentWaitMs: input.input.run.maxCommentWaitMs,
  });
  const download = await downloadCurrentFacebookVideo({
    videoDownload: input.input.videoDownload,
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
  await deleteRejectedFacebookVideo({ videoDownload: input.input.videoDownload, downloaded: input.download });
  const candidate = buildFacebookMiningCandidate({
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    roundIndex: input.input.roundIndex,
    probe: input.probe,
    status: "failed",
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: "duplicate_video_artifact",
  });
  saveFacebookMiningCandidateEvidence({
    storage: input.input.storage,
    candidate,
    comments: input.comments.comments,
    probe: input.probe,
  });
  return FacebookMiningRoundRuntime.stopFacebookMiningRound(await navigateToNextFacebookVideo({
    browser: input.input.browser,
    logger: input.input.runtimeLogger,
    runId: input.input.run.runId,
    missionId: input.input.run.missionId,
    roundId: input.round.roundId,
    feedEntryUrl: input.input.run.feedEntryUrl,
  }));
};

const downloadFacebookMiningRoundArtifacts = async (
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

const judgeFacebookMiningRound = async (input: FacebookMiningRoundContext & {
  artifacts: FacebookMiningRoundArtifacts;
}): Promise<FacebookMiningRoundStageResult<FacebookMiningRoundResolution>> => {
  const judgment = await judgeFacebookProductVideo({
    aiInputGateway: input.input.aiInputGateway,
    providerKind: input.input.run.providerKind,
    modelName: input.input.run.modelName ?? null,
    missionId: input.input.run.missionId,
    runId: input.input.run.runId,
    roundId: input.round.roundId,
    probe: input.artifacts.probe,
    comments: input.artifacts.comments.comments,
    videoFilePath: input.artifacts.download.output.filePath,
    timeoutMs: 180_000,
    maxFileBytes: input.input.run.maxVideoBytes,
  });
  if (judgment.status !== "success") {
    return FacebookMiningRoundRuntime.stopFacebookMiningRound(await handleJudgmentFailure({
      videoDownload: input.input.videoDownload,
      storage: input.input.storage,
      missionId: input.input.run.missionId,
      runId: input.input.run.runId,
      roundId: input.round.roundId,
      roundIndex: input.input.roundIndex,
      probe: input.artifacts.probe,
      comments: input.artifacts.comments,
      download: input.artifacts.download,
      judgment,
    }));
  }
  return FacebookMiningRoundRuntime.continueFacebookMiningRound({ ...input.artifacts, judgment });
};

export const runFacebookMiningRound = async (
  input: FacebookMiningRoundInput,
): Promise<FacebookMiningRoundOutcome> => {
  const context: FacebookMiningRoundContext = {
    input,
    round: buildFacebookMiningRoundState({ run: input.run, roundIndex: input.roundIndex }),
  };
  FacebookMiningRoundRuntime.startFacebookMiningRound(context);
  const probe = await FacebookMiningRoundRuntime.probeFacebookMiningRound(context);
  if (!probe.ok) {
    return probe.outcome;
  }
  const artifacts = await downloadFacebookMiningRoundArtifacts({
    ...context,
    probe: probe.value,
  });
  if (!artifacts.ok) {
    return artifacts.outcome;
  }
  const resolution = await judgeFacebookMiningRound({
    ...context,
    artifacts: artifacts.value,
  });
  if (!resolution.ok) {
    return resolution.outcome;
  }
  await FacebookMiningRoundRuntime.applyFacebookMiningRoundDecision({
    context,
    resolution: resolution.value,
  });
  return FacebookMiningRoundRuntime.completeFacebookMiningRound(context);
};
