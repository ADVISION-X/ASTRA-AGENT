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
  pressArrowDownForNextVideo,
  wheelScrollForNextVideo,
  safeZoneClickForNextVideo,
  runFallbackNavigation,
  type FacebookNavigationAction,
  type FacebookNavigationWaitResult,
  waitForNavigationChange,
} from "./facebook-product-video-mining.navigation-support.js";
import { collectChangedNavigationSignals } from "./facebook-product-video-mining.navigation-proof.js";

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

const runFixedNavigationActionLadder = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
  feedEntryUrl: string;
}): Promise<FacebookNavigationWaitResult & { actionLadder: FacebookNavigationAction[] }> => {
  const actionLadder: FacebookNavigationAction[] = [];
  for (const action of [pressArrowDownForNextVideo, wheelScrollForNextVideo, safeZoneClickForNextVideo, runFallbackNavigation]) {
    actionLadder.push(await action(input.browser));
    const result = await waitForNavigationChange({ browser: input.browser, before: input.before });
    if (result.terminalReason || result.quorumMet) {
      return { ...result, actionLadder };
    }
  }
  const recoverReason = await ensureFacebookFeedTab({ browser: input.browser, feedEntryUrl: input.feedEntryUrl });
  if (recoverReason) {
    return { after: input.before, terminalReason: null, changedSignals: [], quorumMet: false, actionLadder };
  }
  actionLadder.push(await pressArrowDownForNextVideo(input.browser));
  const result = await waitForNavigationChange({ browser: input.browser, before: input.before });
  return { ...result, actionLadder };
};

type NavigationStageRun = ReturnType<ReturnType<typeof createStageLogger>["start"]>;

const failNavigationForSourceTab = ({
  navigationStage,
  reason,
}: {
  navigationStage: NavigationStageRun;
  reason: string;
}): FacebookMiningRoundOutcome => {
  navigationStage.fail({
    reason,
    failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
    retryable: false,
    terminal: false,
    recoveryPolicy: "recover_feed_tab",
    payload: buildRecoverFeedTabPayload(),
  });
  return buildRecoverFeedTabOutcome(reason);
};

const failNavigationStages = ({
  navigationStage,
  verifyStage,
  reason,
  terminalReason,
  newVideoKey,
  beforeSignatureHash,
  afterSignatureHash,
  stableSampleCount,
  navigationPayload,
}: {
  navigationStage: NavigationStageRun;
  verifyStage: NavigationStageRun;
  reason: string;
  terminalReason: string | null;
  newVideoKey: string;
  beforeSignatureHash: string;
  afterSignatureHash: string;
  stableSampleCount: number;
  navigationPayload: ReturnType<typeof buildNavigationPayload>;
}): void => {
  verifyStage.fail({
    reason,
    failureClass: RuntimeFailureClass.NAVIGATION_FAILURE,
    retryable: false,
    terminal: Boolean(terminalReason),
    recoveryPolicy: "review_required",
    refs: { newVideoKey },
    hashes: { afterSignatureHash },
    metrics: { stableSampleCount },
  });
  navigationStage.fail({
    reason,
    failureClass: terminalReason ? RuntimeFailureClass.NAVIGATION_FAILURE : RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
    retryable: false,
    terminal: Boolean(terminalReason),
    recoveryPolicy: terminalReason ? "review_required" : "retry_next_round",
    hashes: { beforeSignatureHash, afterSignatureHash },
    payload: navigationPayload,
  });
};

const completeNavigationStages = ({
  navigationStage,
  verifyStage,
  newVideoKey,
  beforeSignatureHash,
  afterSignatureHash,
  stableSampleCount,
  navigationPayload,
}: {
  navigationStage: NavigationStageRun;
  verifyStage: NavigationStageRun;
  newVideoKey: string;
  beforeSignatureHash: string;
  afterSignatureHash: string;
  stableSampleCount: number;
  navigationPayload: ReturnType<typeof buildNavigationPayload>;
}): void => {
  verifyStage.complete({
    durationMs: 0,
    refs: { newVideoKey },
    hashes: { afterSignatureHash },
    metrics: { stableSampleCount },
  });
  navigationStage.complete({
    durationMs: 0,
    hashes: { beforeSignatureHash, afterSignatureHash },
    payload: navigationPayload,
  });
};

const finalizeNavigationStages = (input: {
  navigationStage: NavigationStageRun;
  verifyStage: NavigationStageRun;
  reason: string | null;
  terminalReason: string | null;
  newVideoKey: string;
  beforeSignatureHash: string;
  afterSignatureHash: string;
  stableSampleCount: number;
  navigationPayload: ReturnType<typeof buildNavigationPayload>;
}): void => {
  if (input.reason) {
    failNavigationStages({
      navigationStage: input.navigationStage,
      verifyStage: input.verifyStage,
      reason: input.reason,
      terminalReason: input.terminalReason,
      newVideoKey: input.newVideoKey,
      beforeSignatureHash: input.beforeSignatureHash,
      afterSignatureHash: input.afterSignatureHash,
      stableSampleCount: input.stableSampleCount,
      navigationPayload: input.navigationPayload,
    });
    return;
  }
  completeNavigationStages({
    navigationStage: input.navigationStage,
    verifyStage: input.verifyStage,
    newVideoKey: input.newVideoKey,
    beforeSignatureHash: input.beforeSignatureHash,
    afterSignatureHash: input.afterSignatureHash,
    stableSampleCount: input.stableSampleCount,
    navigationPayload: input.navigationPayload,
  });
};

const logNavigationOutcomeDebug = (input: {
  logger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  reason: string | null;
  before: FacebookNavigationSignature;
  result: FacebookNavigationWaitResult & { actionLadder: FacebookNavigationAction[] };
  closeAction: FacebookNavigationAction | null;
  changedSignals: readonly string[];
}): void => {
  logFacebookNavigationDebug({
    logger: input.logger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    status: input.result.terminalReason ? "review_required" : input.result.quorumMet ? "success" : "skipped",
    reason: input.reason,
    before: input.before,
    after: input.result.after,
    action: {
      closeAction: input.closeAction,
      actionLadder: input.result.actionLadder,
      changedSignals: input.changedSignals,
      quorumMet: input.result.quorumMet,
    },
  });
};

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
    return failNavigationForSourceTab({ navigationStage, reason: sourceTabFailureReason });
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
  const changedSignals = collectChangedNavigationSignals(before, result.after);
  const actionStrategy = result.actionLadder.map((action) => action.action).join("->") || "none";
  const fallbackUsed = result.actionLadder.some((action) => action.action === "arrow_down_and_scroll");
  const stableSampleCount = changedSignals.length;
  const navigationPayload = buildNavigationPayload({ beforeVideoKey, afterVideoKey, actionStrategy, fallbackUsed });
  finalizeNavigationStages({
    navigationStage,
    verifyStage,
    reason,
    terminalReason: result.terminalReason,
    newVideoKey: afterVideoKey,
    beforeSignatureHash,
    afterSignatureHash,
    stableSampleCount,
    navigationPayload,
  });
  logNavigationOutcomeDebug({
    logger: input.logger,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    reason,
    before,
    result,
    closeAction,
    changedSignals,
  });
  return buildNavigationOutcome({
    reason,
    terminalReason: result.terminalReason,
    actionStrategy,
    beforeHash: beforeSignatureHash,
    afterHash: afterSignatureHash,
  });
};
