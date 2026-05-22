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
  buildFacebookMiningCandidate,
  saveFacebookMiningCandidateEvidence,
} from "./facebook-product-video-mining.candidate-record.js";
import {
  navigateToNextFacebookVideo,
  type FacebookMiningRoundOutcome,
} from "./facebook-product-video-mining.navigation.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
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
}): FacebookMiningRoundOutcome => {
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    status: "review_required",
    commentsLoadedCount: 0,
    commentsComplete: false,
    commentStopReason: input.probe.blocker,
  });
  saveFacebookMiningCandidateEvidence({ storage: input.storage, candidate, comments: [], probe: input.probe });
  const terminal = input.probe.status === "login_required"
    || input.probe.status === "captcha_or_2fa_required"
    || input.probe.blocker === "facebook_rate_limited";
  return { terminal, reason: input.probe.blocker ?? input.probe.status };
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
}): Promise<FacebookMiningRoundOutcome> => {
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    status: "failed",
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.download.failureReason,
  });
  saveFacebookMiningCandidateEvidence({ storage: input.storage, candidate, comments: input.comments.comments, probe: input.probe });
  return navigateToNextFacebookVideo({
    browser: input.browser,
    logger: input.runtimeLogger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    feedEntryUrl: input.feedEntryUrl,
  });
};

const saveJudgmentFailureCandidate = (input: {
  storage: FacebookProductVideoMiningStorage;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  judgment: FacebookVideoAiJudgment;
}): void => {
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    judgment: input.judgment,
    status: "review_required",
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
  });
  saveFacebookMiningCandidateEvidence({
    storage: input.storage,
    candidate,
    comments: input.comments.comments,
    judgment: input.judgment,
    probe: input.probe,
  });
};

export const handleJudgmentFailure = async (input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  videoDownload: VideoDownloadAbilityGroup;
  storage: FacebookProductVideoMiningStorage;
  feedEntryUrl: string;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  download: SuccessfulVideoDownload;
  judgment: FacebookVideoAiJudgment;
}): Promise<FacebookMiningRoundOutcome> => {
  await deleteRejectedFacebookVideo({ videoDownload: input.videoDownload, downloaded: input.download });
  saveJudgmentFailureCandidate(input);
  return { terminal: true, reason: input.judgment.reason };
};

export const handleAcceptedJudgment = async (input: {
  videoDownload: VideoDownloadAbilityGroup;
  dataDir: string;
  storage: FacebookProductVideoMiningStorage;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  download: SuccessfulVideoDownload;
  judgment: FacebookVideoAiJudgment;
}): Promise<void> => {
  const promoted = await promoteAcceptedFacebookVideo({
    videoDownload: input.videoDownload,
    dataDir: input.dataDir,
    missionId: input.missionId,
    runId: input.runId,
    videoId: input.probe.facebookVideoId ?? input.roundId,
    downloaded: input.download,
  });
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    judgment: input.judgment,
    download: promoted && isSuccessfulVideoDownload(promoted) ? promoted : input.download,
    status: "saved",
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
  });
  saveFacebookMiningCandidateEvidence({ storage: input.storage, candidate, comments: input.comments.comments, judgment: input.judgment, probe: input.probe });
};

export const handleRejectedJudgment = async (input: {
  browser: BrowserController;
  videoDownload: VideoDownloadAbilityGroup;
  storage: FacebookProductVideoMiningStorage;
  notInterestedEnabled: boolean;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult;
  download: SuccessfulVideoDownload;
  judgment: FacebookVideoAiJudgment;
}): Promise<void> => {
  const action = input.notInterestedEnabled ? await clickFacebookNotInterested({ browser: input.browser, probe: input.probe }) : null;
  await deleteRejectedFacebookVideo({ videoDownload: input.videoDownload, downloaded: input.download });
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    judgment: input.judgment,
    status: input.judgment.selectedOptionId === "UNCERTAIN" ? "uncertain" : "rejected",
    commentsLoadedCount: input.comments.comments.length,
    commentsComplete: input.comments.commentsComplete,
    commentStopReason: input.comments.stopReason,
    notInterestedStatus: action?.status ?? "disabled",
  });
  saveFacebookMiningCandidateEvidence({ storage: input.storage, candidate, comments: input.comments.comments, judgment: input.judgment, probe: input.probe });
};
