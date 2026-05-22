import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import { logFacebookNavigationDebug } from "./facebook-product-video-mining.logging.js";
import {
  buildNavigationSignatureScript,
  buildPrepareForNextVideoScript,
  type FacebookNavigationSignature,
} from "./facebook-product-video-mining.navigation-scripts.js";
import {
  buildNavigationHash,
  closeCommentSurface,
  buildNavigationOutcome,
  buildNavigationPayload,
  buildNavigationVideoKey,
  ensureFacebookFeedTab,
  isFacebookPageUrl,
  type FacebookNavigationAction,
  type FacebookNavigationWaitResult,
  runFixedNavigationActionLadder,
} from "./facebook-product-video-mining.navigation-support.js";

export type FacebookMiningRoundOutcome = {
  terminal: boolean;
  reason: string | null;
  failureClass?: string | null;
  recoveryPolicy?: string | null;
  recoveryTrail?: string | null;
  action?: string | null;
  beforeHash?: string | null;
  afterHash?: string | null;
  durationMs?: number | null;
  candidateId?: string | null;
  confidence?: number | null;
};

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;

const captureNavigationSignature = (
  browser: BrowserController,
  description: string,
): Promise<FacebookNavigationSignature> => browser.evaluateActiveTab<FacebookNavigationSignature>({
  description,
  script: buildNavigationSignatureScript(),
});

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

const closeBlockingSurfaces = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<FacebookNavigationAction | null> => input.before.activeDialogCount > 0
  ? input.browser.evaluateActiveTab<FacebookNavigationAction>({
    description: "prepare Facebook feed for next video navigation",
    script: buildPrepareForNextVideoScript(),
  })
  : null;

type NavigateToNextFacebookVideoInput = {
  browser: BrowserController;
  logger: RuntimeLogger;
  runId: string;
  missionId: string;
  roundId: string;
  feedEntryUrl: string;
};

const buildRecoverFeedTabPayload = () => ({
  recoveryTrail: "facebook-navigation-recovery-trail",
  actionStrategy: "recover_feed_tab",
  fallbackUsed: true,
});

const buildRecoverFeedTabOutcome = (reason: string): FacebookMiningRoundOutcome => ({
  terminal: false,
  reason,
  failureClass: "RECOVERABLE_BROWSER_DRIFT",
  recoveryPolicy: "recover_feed_tab",
  recoveryTrail: "facebook-navigation-recovery-trail",
  action: "recover_feed_tab",
  beforeHash: "navigation-before-unavailable",
  afterHash: "navigation-after-unavailable",
  durationMs: 0,
});

export const navigateToNextFacebookVideo = async (input: NavigateToNextFacebookVideoInput): Promise<FacebookMiningRoundOutcome> => {
  const stageLogger = createStageLogger({ logger: input.logger });
  const traceContext = createFacebookRoundTrace(input);
  const navigationStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_NAVIGATION_NEXT",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
  });
  const sourceTabFailureReason = await ensureFacebookFeedTab({ browser: input.browser, feedEntryUrl: input.feedEntryUrl });
  if (sourceTabFailureReason) {
    navigationStage.fail({
      reason: sourceTabFailureReason,
      failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
      retryable: false,
      terminal: false,
      recoveryPolicy: "recover_feed_tab",
      payload: buildRecoverFeedTabPayload(),
    });
    return buildRecoverFeedTabOutcome(sourceTabFailureReason);
  }
  await closeCommentSurface(input.browser);
  const before = await captureNavigationSignature(input.browser, "capture Facebook video signature before navigation");
  const beforeSignatureHash = buildNavigationHash(before.signature);
  const beforeVideoKey = buildNavigationVideoKey(before);
  const closeAction = await closeBlockingSurfaces({ browser: input.browser, before });
  const verifyStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_VERIFY_NEXT_STABLE",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    refs: { newVideoKey: beforeVideoKey },
    hashes: { beforeSignatureHash },
  });
  const result = await runFixedNavigationActionLadder({ browser: input.browser, before, feedEntryUrl: input.feedEntryUrl });
  const reason = result.terminalReason ?? (result.quorumMet ? null : "next_video_not_confirmed");
  const afterSignatureHash = buildNavigationHash(result.after.signature);
  const afterVideoKey = buildNavigationVideoKey(result.after);
  const actionStrategy = result.actionLadder.map((action) => action.action).join("->") || "none";
  const fallbackUsed = result.actionLadder.some((action) => action.action === "arrow_down_and_scroll");
  const stableMetrics = { stableSampleCount: result.changedSignals.length };
  const navigationPayload = buildNavigationPayload({ beforeVideoKey, afterVideoKey, actionStrategy, fallbackUsed });
  const verificationRefs = { newVideoKey: afterVideoKey };
  const navigationHashes = { beforeSignatureHash, afterSignatureHash };
  if (reason) {
    verifyStage.fail({
      reason,
      failureClass: RuntimeFailureClass.NAVIGATION_FAILURE,
      retryable: false,
      terminal: Boolean(result.terminalReason),
      recoveryPolicy: "review_required",
      refs: verificationRefs,
      hashes: { afterSignatureHash },
      metrics: stableMetrics,
    });
    if (result.terminalReason) {
      navigationStage.fail({
        reason,
        failureClass: RuntimeFailureClass.NAVIGATION_FAILURE,
        retryable: false,
        terminal: true,
        recoveryPolicy: "review_required",
        hashes: navigationHashes,
        payload: navigationPayload,
      });
    } else {
      navigationStage.fail({
        reason,
        failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
        retryable: false,
        terminal: false,
        recoveryPolicy: "retry_next_round",
        hashes: navigationHashes,
        payload: navigationPayload,
      });
    }
  } else {
    verifyStage.complete({
      durationMs: 0,
      refs: verificationRefs,
      hashes: { afterSignatureHash },
      metrics: stableMetrics,
    });
    navigationStage.complete({
      durationMs: 0,
      hashes: navigationHashes,
      payload: navigationPayload,
    });
  }
  logFacebookNavigationDebug({
    logger: input.logger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    status: result.terminalReason ? "review_required" : result.quorumMet ? "success" : "skipped",
    reason,
    before,
    after: result.after,
    action: { closeAction, actionLadder: result.actionLadder, changedSignals: result.changedSignals, quorumMet: result.quorumMet },
  });
  return buildNavigationOutcome({
    reason,
    terminalReason: result.terminalReason,
    actionStrategy,
    beforeHash: beforeSignatureHash,
    afterHash: afterSignatureHash,
  });
};
