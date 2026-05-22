import type { VideoDownloadResult } from "../../capabilities/video-download/index.js";
import { FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID } from "./facebook-product-video-mining.ai-judge.js";
import { createFacebookMiningAiJudgmentId, createFacebookMiningCandidateId } from "./facebook-product-video-mining.result.js";
import type {
  FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";

type FacebookProductVideoCandidateRecord = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type CandidateVideoDownload = {
  output: Pick<
    Extract<VideoDownloadResult["output"], { status: "success" }>,
    | "artifactRef"
    | "filePath"
    | "sha256"
    | "byteSize"
    | "contentType"
    | "artifactDisposition"
  >;
};

type BuildFacebookMiningCandidateInput = {
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  judgment?: FacebookVideoAiJudgment | null;
  download?: CandidateVideoDownload | null;
  status: FacebookProductVideoCandidateRecord["status"];
  commentsLoadedCount: number;
  commentsComplete: boolean;
  commentStopReason: string | null;
  notInterestedStatus?: string | null;
};

const buildCandidateVideoFields = (
  status: FacebookProductVideoCandidateRecord["status"],
  download?: CandidateVideoDownload | null,
) => {
  if (!download) {
    return {
      videoArtifactRef: null,
      videoFilePath: null,
      videoSha256: null,
      videoByteSize: null,
      videoContentType: null,
      videoArtifactDisposition: null,
    };
  }
  if (status !== "saved") {
    return {
      videoArtifactRef: download.output.artifactRef,
      videoFilePath: null,
      videoSha256: null,
      videoByteSize: null,
      videoContentType: null,
      videoArtifactDisposition: null,
    };
  }
  return {
    videoArtifactRef: download.output.artifactRef,
    videoFilePath: download.output.filePath,
    videoSha256: download.output.sha256,
    videoByteSize: download.output.byteSize,
    videoContentType: download.output.contentType,
    videoArtifactDisposition: download.output.artifactDisposition,
  };
};

const buildCandidateProbeFields = (probe: FacebookVideoDomProbeResult) => ({
  sourcePageUrl: probe.sourcePageUrl,
  facebookVideoId: probe.facebookVideoId,
  pageTitle: probe.pageTitle,
  authorText: probe.authorText,
  captionText: probe.captionText,
  likeCount: probe.likeCount,
  commentCountDisplayed: probe.commentCountDisplayed,
});

const buildCandidateCommentFields = (input: {
  commentsLoadedCount: number;
  commentsComplete: boolean;
  commentStopReason: string | null;
  commentCountDisplayed: number | null;
}) => ({
  commentsLoadedCount: input.commentsLoadedCount,
  commentsComplete: input.commentCountDisplayed !== null && input.commentsLoadedCount < input.commentCountDisplayed
    ? false
    : input.commentsComplete,
  commentStopReason: input.commentCountDisplayed !== null && input.commentsLoadedCount < input.commentCountDisplayed
    ? "displayed_comment_count_not_fully_loaded"
    : input.commentStopReason,
});

const buildCandidateJudgmentFields = (judgment?: FacebookVideoAiJudgment | null) => ({
  aiSelectedOptionId: judgment?.selectedOptionId ?? null,
  aiConfidence: judgment?.confidence ?? null,
  aiReason: judgment?.reason ?? null,
});

const buildCandidateIdentityFields = (input: BuildFacebookMiningCandidateInput) => ({
  id: createFacebookMiningCandidateId(),
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId,
  roundIndex: input.roundIndex,
});

const buildCandidateLifecycleFields = (input: BuildFacebookMiningCandidateInput) => ({
  status: input.status,
  notInterestedStatus: input.notInterestedStatus ?? null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
});

export const buildFacebookMiningCandidate = (
  input: BuildFacebookMiningCandidateInput,
): FacebookProductVideoCandidateRecord => ({
  ...buildCandidateIdentityFields(input),
  ...buildCandidateProbeFields(input.probe),
  ...buildCandidateCommentFields({
    commentsLoadedCount: input.commentsLoadedCount,
    commentsComplete: input.commentsComplete,
    commentStopReason: input.commentStopReason,
    commentCountDisplayed: input.probe.commentCountDisplayed,
  }),
  ...buildCandidateJudgmentFields(input.judgment),
  ...buildCandidateVideoFields(input.status, input.download),
  ...buildCandidateLifecycleFields(input),
});

export const saveFacebookMiningCandidateEvidence = (input: {
  storage: FacebookProductVideoMiningStorage;
  candidate: FacebookProductVideoCandidateRecord;
  comments: Parameters<FacebookProductVideoMiningStorage["saveComments"]>[1];
  judgment?: FacebookVideoAiJudgment | null;
  probe: FacebookVideoDomProbeResult;
}): void => {
  input.storage.saveCandidate({
    candidate: input.candidate,
    rawDomProbeJson: JSON.stringify(input.probe),
  });
  input.storage.saveComments(input.candidate.id, input.comments);
  if (!input.judgment) {
    return;
  }
  input.storage.saveAiJudgment({
    id: createFacebookMiningAiJudgmentId(),
    candidateId: input.candidate.id,
    promptContractId: FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
    judgment: input.judgment,
  });
};