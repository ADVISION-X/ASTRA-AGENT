import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  createStageLogger,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";
import {
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  buildCommentsHash,
  collectFacebookCommentRounds,
  createFacebookCommentTraceContext,
  openFacebookCommentSurface,
} from "./facebook-product-video-mining.comments-support.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

export type FacebookCommentCollectionResult = {
  status: "success" | "review_required" | "failed";
  comments: FacebookCommentRecord[];
  commentsComplete: boolean;
  stopReason: string | null;
  reason: string | null;
};

type CollectAllLoadableCommentsInput = {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  probe: FacebookVideoDomProbeResult;
  maxCommentScrolls: number;
  maxCommentWaitMs: number;
};

export const collectAllLoadableComments = async (input: CollectAllLoadableCommentsInput): Promise<FacebookCommentCollectionResult> => {
  const commentsRef = `comments:${input.roundId}`;
  const traceContext = createFacebookCommentTraceContext(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const commentStage = stageLogger.start({ context: traceContext, stageName: "FACEBOOK_COMMENT_COLLECTION", modeVisibility: ["FLOW", "DEBUG", "TRACE"], refs: { commentsRef } });
  const deadline = Date.now() + input.maxCommentWaitMs;
  const openFailure = await openFacebookCommentSurface({ browser: input.browser, probe: input.probe, deadline });
  if (openFailure) {
    commentStage.fail({ reason: openFailure.reason ?? "facebook_comment_surface_unavailable", failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE, retryable: false, terminal: false, recoveryPolicy: "review_required", refs: { commentsRef }, hashes: { commentsHash: buildCommentsHash(openFailure.comments) }, metrics: { commentsLoadedCount: openFailure.comments.length }, payload: { recoveryTrail: "facebook-comment-recovery-trail", action: "open_comment_surface", beforeHash: "comments-before", afterHash: "comments-after" } });
    return openFailure;
  }
  const result = await collectFacebookCommentRounds({ browser: input.browser, maxCommentScrolls: input.maxCommentScrolls, deadline });
  if (result.reason) {
    commentStage.fail({ reason: result.reason ?? result.stopReason ?? "facebook_comment_collection_failed", failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE, retryable: false, terminal: false, recoveryPolicy: "review_required", refs: { commentsRef }, hashes: { commentsHash: buildCommentsHash(result.comments) }, metrics: { commentsLoadedCount: result.comments.length }, payload: { recoveryTrail: "facebook-comment-recovery-trail", action: "expand_comments", beforeHash: "comments-before", afterHash: "comments-after" } });
    return result;
  }
  commentStage.complete({ durationMs: 0, refs: { commentsRef }, hashes: { commentsHash: buildCommentsHash(result.comments) }, metrics: { commentsLoadedCount: result.comments.length }, payload: { recoveryTrail: "facebook-comment-recovery-trail", action: "expand_comments", beforeHash: "comments-before", afterHash: "comments-after" } });
  return result;
};
