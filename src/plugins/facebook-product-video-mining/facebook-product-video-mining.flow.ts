import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createStageLogger,
  type RuntimeLogger,
  type RuntimeTraceContext,
} from "../../lib/runtime-logs/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
import {
  buildFacebookMiningRunConfig,
} from "./facebook-product-video-mining.result.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";
import { createFacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";
import { runFacebookMiningRound } from "./facebook-product-video-mining.round.js";
import { logFacebookMiningFlow } from "./facebook-product-video-mining.logging.js";
import { focusExistingFacebookVideoTab } from "./facebook-product-video-mining.chrome-tabs.js";
import {
  FACEBOOK_VIDEO_READY_DETECTOR_SCRIPT,
  createFacebookMissionTraceContext,
  finalizeFacebookMiningMission,
  handleMissionOpenFailure,
  logFacebookMiningMissionStarted,
  markFacebookMiningMissionRunning,
} from "./facebook-product-video-mining.flow-support.js";

type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];
type FacebookProductVideoMiningRun = ReturnType<typeof buildFacebookMiningRunConfig>;

const FACEBOOK_BROWSER_SESSION_REF = "facebook-browser-session";

const buildMissionPreflightConfigHash = (run: FacebookProductVideoMiningRun): string =>
  `${run.providerKind}:${run.targetProductCount}:${run.maxRounds}:${run.maxMinutes}`;

const buildMissionPreflightDebugBundleRef = (run: FacebookProductVideoMiningRun): string =>
  `facebook-debug-bundle-${run.runId}`;

const buildMissionPreflightStageStart = (run: FacebookProductVideoMiningRun) => ({
  stageName: "FACEBOOK_MISSION_PREFLIGHT",
  modeVisibility: ["FLOW", "DEBUG", "TRACE"] as const,
  refs: { debugBundleRef: buildMissionPreflightDebugBundleRef(run) },
  hashes: { configHash: buildMissionPreflightConfigHash(run) },
  metrics: {
    targetProductCount: run.targetProductCount,
    maxRounds: run.maxRounds,
    maxMinutes: run.maxMinutes,
  },
  preview: {
    providerKind: run.providerKind,
    modelName: run.modelName ?? "default",
  },
  payload: {
    status: "started",
    schemaFailureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
    fallbackFailureClass: RuntimeFailureClass.INTERNAL_BUG,
  },
});

const buildMissionPreflightStageComplete = (run: FacebookProductVideoMiningRun) => ({
  durationMs: 0,
  refs: { debugBundleRef: buildMissionPreflightDebugBundleRef(run) },
  hashes: { configHash: buildMissionPreflightConfigHash(run) },
  metrics: {
    targetProductCount: run.targetProductCount,
    maxRounds: run.maxRounds,
    maxMinutes: run.maxMinutes,
  },
  payload: {
    status: "success",
    schemaFailureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
    fallbackFailureClass: RuntimeFailureClass.INTERNAL_BUG,
    recoveryTrail: "facebook-open-feed-recovery-trail",
    action: "mission_preflight",
    beforeHash: "mission-preflight-before",
    afterHash: "mission-preflight-after",
  },
});

type FacebookFeedVideoWaitResult = {
  ready: boolean;
  reason: string | null;
  stableSampleCount: number;
  currentSrcHash: string;
};

const buildBlockedFeedVideoWaitResult = (stableSampleCount: number, currentSrcHash: string): FacebookFeedVideoWaitResult => ({
  ready: false,
  reason: "facebook_feed_blocked_before_video_ready",
  stableSampleCount,
  currentSrcHash,
});

const buildReadyFeedVideoWaitResult = (stableSampleCount: number, currentSrcHash: string): FacebookFeedVideoWaitResult => ({
  ready: true,
  reason: null,
  stableSampleCount,
  currentSrcHash,
});

const buildTimedOutFeedVideoWaitResult = (stableSampleCount: number): FacebookFeedVideoWaitResult => ({
  ready: false,
  reason: "facebook_video_not_ready_after_open",
  stableSampleCount,
  currentSrcHash: "0",
});

const buildOpenFeedFailurePayload = () => ({
  recoveryTrail: "facebook-open-feed-recovery-trail",
  action: "open_facebook_feed",
  beforeHash: "open-feed-before",
  afterHash: "open-feed-after",
});

const buildWaitVideoStableEvidence = (waitResult: FacebookFeedVideoWaitResult) => ({
  hashes: { currentSrcHash: waitResult.currentSrcHash },
  metrics: { stableSampleCount: waitResult.stableSampleCount },
  payload: {
    recoveryTrail: "facebook-open-feed-recovery-trail",
    action: "wait_video_stable",
    beforeHash: "open-feed-before",
    afterHash: "open-feed-after",
  },
});

type FacebookFlowStageLogger = ReturnType<typeof createStageLogger>;

type FacebookFlowStageInput = {
  browser: BrowserController;
  run: FacebookProductVideoMiningRun;
  traceContext: RuntimeTraceContext;
  stageLogger: FacebookFlowStageLogger;
};

export type FacebookProductVideoMiningContext = {
  browser: BrowserController;
  videoDownload: VideoDownloadAbilityGroup;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
};

const waitForFacebookFeedVideo = async (input: {
  browser: BrowserController;
  maxWaitMs: number;
}): Promise<FacebookFeedVideoWaitResult> => {
  const deadline = Date.now() + input.maxWaitMs;
  let stableSampleCount = 0;
  while (Date.now() < deadline) {
    const state = await input.browser.evaluateActiveTab<{
      hasVideo: boolean;
      blockerText: string | null;
      currentSrcHash: string;
    }>({
      description: "wait until Facebook feed exposes a real video element",
      script: FACEBOOK_VIDEO_READY_DETECTOR_SCRIPT,
    });
    stableSampleCount += 1;
    if (state.blockerText) {
        return buildBlockedFeedVideoWaitResult(stableSampleCount, state.currentSrcHash);
    }
    if (state.hasVideo) {
        return buildReadyFeedVideoWaitResult(stableSampleCount, state.currentSrcHash);
    }
    await input.browser.wait(300);
  }
    return buildTimedOutFeedVideoWaitResult(stableSampleCount);
};

const openFacebookMiningFeedTab = async (input: FacebookFlowStageInput): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const openFeedStage = input.stageLogger.start({
    context: input.traceContext,
    stageName: "FACEBOOK_OPEN_FEED",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    refs: { browserSessionRef: FACEBOOK_BROWSER_SESSION_REF },
    payload: { fallbackFailureClass: RuntimeFailureClass.INTERNAL_BUG },
  });
  const focusedExisting = await focusExistingFacebookVideoTab({ preferredUrl: null });
  const openResult = focusedExisting
    ? { ok: true, message: "focused existing Facebook video tab" }
    : await input.browser.open({ url: input.run.feedEntryUrl, title: "Facebook product video mining feed" });
  if (!openResult.ok) {
    openFeedStage.fail({
      reason: openResult.message,
      failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
      retryable: true,
      terminal: false,
      recoveryPolicy: "review_required",
      refs: { browserSessionRef: FACEBOOK_BROWSER_SESSION_REF },
      payload: buildOpenFeedFailurePayload(),
    });
    return { ok: false, reason: openResult.message };
  }
  openFeedStage.complete({
    durationMs: 0,
    refs: { browserSessionRef: FACEBOOK_BROWSER_SESSION_REF },
  });
  return { ok: true };
};

const waitForFacebookFeedVideoReady = async (input: FacebookFlowStageInput): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const waitStage = input.stageLogger.start({ context: input.traceContext, stageName: "FACEBOOK_WAIT_VIDEO_STABLE", modeVisibility: ["DEBUG", "TRACE"] });
  const waitResult = await waitForFacebookFeedVideo({ browser: input.browser, maxWaitMs: Math.min(20_000, input.run.maxMinutes * 60_000) });
  if (!waitResult.ready) {
    const waitStageEvidence = buildWaitVideoStableEvidence(waitResult);
    if (waitResult.reason === "facebook_feed_blocked_before_video_ready") {
      waitStage.fail({ reason: waitResult.reason, failureClass: RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER, retryable: true, terminal: false, recoveryPolicy: "review_required", ...waitStageEvidence });
      return { ok: false, reason: waitResult.reason };
    }
    if (waitResult.reason === "facebook_video_not_ready_after_open") {
      waitStage.fail({ reason: waitResult.reason, failureClass: RuntimeFailureClass.PLATFORM_RATE_LIMIT, retryable: true, terminal: false, recoveryPolicy: "review_required", ...waitStageEvidence });
      return { ok: false, reason: waitResult.reason };
    }
    waitStage.fail({ reason: waitResult.reason ?? "facebook_wait_video_probe_failed", failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE, retryable: true, terminal: false, recoveryPolicy: "review_required", ...waitStageEvidence });
    return { ok: false, reason: waitResult.reason ?? "facebook_wait_video_probe_failed" };
  }
  waitStage.complete({ durationMs: 0, hashes: { currentSrcHash: waitResult.currentSrcHash }, metrics: { stableSampleCount: waitResult.stableSampleCount } });
  return { ok: true };
};

const openFacebookMiningFeed = async (input: {
  browser: BrowserController;
  run: FacebookProductVideoMiningRun;
  runtimeLogger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
}): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const stageInput = { browser: input.browser, run: input.run, traceContext: input.traceContext, stageLogger };
  const openResult = await openFacebookMiningFeedTab(stageInput);
  if (!openResult.ok) {
    return openResult;
  }
  return waitForFacebookFeedVideoReady(stageInput);
};

const runFacebookMiningRoundsForMission = async (input: {
  context: FacebookProductVideoMiningContext;
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  run: FacebookProductVideoMiningRun;
}): Promise<string | null> => {
  const started = Date.now();
  let terminalReason: string | null = null;
  for (let roundIndex = 0; roundIndex < input.run.maxRounds; roundIndex += 1) {
    const status = input.storage.getRunStatus(input.run.runId);
    if (!status || status.savedProductCount >= input.run.targetProductCount) {
      break;
    }
    if ((Date.now() - started) / 60_000 >= input.run.maxMinutes) {
      break;
    }
    const outcome = await runFacebookMiningRound({ ...input.context, storage: input.storage, run: input.run, roundIndex });
    if (outcome.terminal) {
      terminalReason = outcome.reason;
      break;
    }
  }
  return terminalReason;
};

export const runFacebookProductVideoMiningMission = async (
  run: FacebookProductVideoMiningRun,
  context: FacebookProductVideoMiningContext,
): Promise<FacebookProductVideoMiningRunStatus> => {
  const storage = createFacebookProductVideoMiningStorage(context.dataDir);
  const missionTrace = createFacebookMissionTraceContext(run);
  const stageLogger = createStageLogger({ logger: context.runtimeLogger });
  try {
    const preflightStageStart = buildMissionPreflightStageStart(run);
    const preflightStage = stageLogger.start({
      context: missionTrace,
      stageName: "FACEBOOK_MISSION_PREFLIGHT",
      modeVisibility: [...preflightStageStart.modeVisibility],
      refs: preflightStageStart.refs, hashes: preflightStageStart.hashes, metrics: preflightStageStart.metrics,
      preview: preflightStageStart.preview, payload: preflightStageStart.payload,
    });
    markFacebookMiningMissionRunning({ storage, run });
    preflightStage.complete(buildMissionPreflightStageComplete(run));
    logFacebookMiningMissionStarted({ runtimeLogger: context.runtimeLogger, run });
    const openResult = await openFacebookMiningFeed({ browser: context.browser, run, runtimeLogger: context.runtimeLogger, traceContext: missionTrace });
    if (!openResult.ok) {
      return handleMissionOpenFailure({ storage, runtimeLogger: context.runtimeLogger, run, reason: openResult.reason });
    }
    const started = Date.now();
    const terminalReason = await runFacebookMiningRoundsForMission({ context, storage, run });
    return finalizeFacebookMiningMission({ storage, runtimeLogger: context.runtimeLogger, run, terminalReason, startedAt: started });
  } finally {
    storage.close();
  }
};
