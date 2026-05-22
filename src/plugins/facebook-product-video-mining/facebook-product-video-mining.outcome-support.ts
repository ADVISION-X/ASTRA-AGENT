import {
  buildFacebookMiningCandidate,
  saveFacebookMiningCandidateEvidence,
} from "./facebook-product-video-mining.candidate-record.js";
import type { FacebookCommentCollectionResult } from "./facebook-product-video-mining.comments.js";
import type {
  FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";
import type { FacebookMiningRoundOutcome } from "./facebook-product-video-mining.navigation.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];
type FacebookProductVideoCandidateStatus = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"]["status"];
type CandidateVideoDownload = NonNullable<Parameters<typeof buildFacebookMiningCandidate>[0]["download"]>;

export type FacebookRoundFailureContract = {
  failureClass: string;
  recoveryPolicy: string;
  recoveryTrail: string;
  action: string;
  beforeHash: string;
  afterHash: string;
  durationMs: number;
  terminal: boolean;
  reason: string | null;
};

export const buildRoundFailureOutcome = (input: {
  failureContract: FacebookRoundFailureContract;
  outcome?: FacebookMiningRoundOutcome;
  terminal?: boolean;
  reason?: string | null;
}): FacebookMiningRoundOutcome => ({
  ...(input.outcome ?? { terminal: input.failureContract.terminal, reason: input.failureContract.reason }),
  terminal: input.terminal ?? input.failureContract.terminal,
  reason: input.reason ?? input.failureContract.reason,
  failureClass: input.failureContract.failureClass,
  recoveryPolicy: input.failureContract.recoveryPolicy,
  recoveryTrail: input.failureContract.recoveryTrail,
  action: input.failureContract.action,
  beforeHash: input.failureContract.beforeHash,
  afterHash: input.failureContract.afterHash,
  durationMs: input.failureContract.durationMs,
});

export const saveRoundCandidateEvidence = (input: {
  storage: FacebookProductVideoMiningStorage;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  comments: FacebookCommentCollectionResult["comments"];
  commentsLoadedCount: number;
  commentsComplete: boolean;
  commentStopReason: string | null;
  status: FacebookProductVideoCandidateStatus;
  judgment?: FacebookVideoAiJudgment | null;
  download?: CandidateVideoDownload | null;
  notInterestedStatus?: string | null;
}): ReturnType<typeof buildFacebookMiningCandidate> => {
  const candidate = buildFacebookMiningCandidate({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    probe: input.probe,
    ...(input.judgment ? { judgment: input.judgment } : {}),
    ...(input.download ? { download: input.download } : {}),
    status: input.status,
    commentsLoadedCount: input.commentsLoadedCount,
    commentsComplete: input.commentsComplete,
    commentStopReason: input.commentStopReason,
    ...(input.notInterestedStatus !== undefined ? { notInterestedStatus: input.notInterestedStatus } : {}),
  });
  saveFacebookMiningCandidateEvidence({
    storage: input.storage,
    candidate,
    comments: input.comments,
    ...(input.judgment ? { judgment: input.judgment } : {}),
    probe: input.probe,
  });
  return candidate;
};

export const buildDecisionApplySummary = (candidateId: string, confidence: number | null) => ({
  candidateId,
  confidence,
});