import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { VideoDownloadAbilityGroup, VideoDownloadResult } from "../../capabilities/video-download/index.js";
import { type FacebookCommentCollectionResult } from "./facebook-product-video-mining.comments.js";
import { clickFacebookNotInterested } from "./facebook-product-video-mining.not-interested.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";
import {
  deleteRejectedFacebookVideo,
  promoteAcceptedFacebookVideo,
} from "./facebook-product-video-mining.video.js";
import {
  navigateToNextFacebookVideo,
  type FacebookMiningRoundOutcome,
} from "./facebook-product-video-mining.navigation.js";
import {
  buildDecisionApplySummary,
  buildRoundFailureOutcome,
  saveRoundCandidateEvidence,
  type FacebookRoundFailureContract,
} from "./facebook-product-video-mining.outcome-support.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

export type FacebookDecisionApplySummary = {
  candidateId: string;
  confidence: number | null;
};

type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
};

type RoundDecisionInput = {
  videoDownload: VideoDownloadAbilityGroup;
  runtimeLogger: RuntimeLogger;
  storage: FacebookProductVideoMiningStorage;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  download: SuccessfulVideoDownload;
  judgment: FacebookVideoAiJudgment;
};

type JudgmentFailureInput = RoundDecisionInput & {
  browser: BrowserController;
  feedEntryUrl: string;
  failureContract: FacebookRoundFailureContract;
};

type AcceptedJudgmentInput = RoundDecisionInput & {
  dataDir: string;
};

type RejectedJudgmentInput = RoundDecisionInput & {
  browser: BrowserController;
  notInterestedEnabled: boolean;
};

const isSuccessfulVideoDownload = (
  result: VideoDownloadResult,
): result is SuccessfulVideoDownload => result.status === "success" && result.output.status === "success";

export const handleProbeFailure = (input: {
  storage: FacebookProductVideoMiningStorage;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  failureContract: FacebookRoundFailureContract;
}): FacebookMiningRoundOutcome => {
  saveRoundCandidateEvidence({
    storage: input.storage,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    comments: [],
    commentsLoadedCount: 0,
    commentsComplete: false,
    commentStopReason: input.probe.blocker,
    status: "review_required",
  });
  const terminal = input.probe.status === "login_required"
    || input.probe.status === "captcha_or_2fa_required"
    || input.probe.blocker === "facebook_rate_limited";
  return buildRoundFailureOutcome({
    failureContract: input.failureContract,
    terminal,
    reason: input.probe.blocker ?? input.probe.status,
  });
};

export const handleDownloadFailure = (input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  storage: FacebookProductVideoMiningStorage;
  feedEntryUrl: string;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  download: VideoDownloadResult;
  failureContract: FacebookRoundFailureContract;
}): Promise<FacebookMiningRoundOutcome> => {
  saveRoundCandidateEvidence({
    storage: input.storage,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    comments: input.comments.comments,
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.download.failureReason,
    status: "failed",
  });
  return navigateToNextFacebookVideo({
    browser: input.browser,
    logger: input.runtimeLogger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    feedEntryUrl: input.feedEntryUrl,
  }).then((outcome) => buildRoundFailureOutcome({
    failureContract: input.failureContract,
    outcome,
  }));
};

export const handleJudgmentFailure = async (input: JudgmentFailureInput): Promise<FacebookMiningRoundOutcome> => {
  await deleteRejectedFacebookVideo({
    videoDownload: input.videoDownload,
    runtimeLogger: input.runtimeLogger,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    downloaded: input.download,
  });
  saveRoundCandidateEvidence({
    storage: input.storage,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    comments: input.comments.comments,
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
    status: "review_required",
    judgment: input.judgment,
  });
  return buildRoundFailureOutcome({ failureContract: input.failureContract });
};

export const handleAcceptedJudgment = async (input: AcceptedJudgmentInput): Promise<FacebookDecisionApplySummary> => {
  const promoted = await promoteAcceptedFacebookVideo({
    videoDownload: input.videoDownload,
    runtimeLogger: input.runtimeLogger,
    dataDir: input.dataDir,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    videoId: input.probe.facebookVideoId ?? input.roundId,
    downloaded: input.download,
  });
  const candidate = saveRoundCandidateEvidence({
    storage: input.storage,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    comments: input.comments.comments,
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
    status: "saved",
    judgment: input.judgment,
    download: promoted && isSuccessfulVideoDownload(promoted) ? promoted : input.download,
  });
  return buildDecisionApplySummary(candidate.id, input.judgment.confidence);
};

export const handleRejectedJudgment = async (input: RejectedJudgmentInput): Promise<FacebookDecisionApplySummary> => {
  const action = input.notInterestedEnabled ? await clickFacebookNotInterested({
    browser: input.browser,
    runtimeLogger: input.runtimeLogger,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    probe: input.probe,
  }) : null;
  await deleteRejectedFacebookVideo({
    videoDownload: input.videoDownload,
    runtimeLogger: input.runtimeLogger,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    downloaded: input.download,
  });
  const candidate = saveRoundCandidateEvidence({
    storage: input.storage,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    comments: input.comments.comments,
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
    status: input.judgment.selectedOptionId === "UNCERTAIN" ? "uncertain" : "rejected",
    judgment: input.judgment,
    notInterestedStatus: action?.status ?? "disabled",
  });
  return buildDecisionApplySummary(candidate.id, input.judgment.confidence);
};
