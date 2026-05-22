import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  type RuntimeTraceContext,
} from "../../lib/runtime-logs/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
import {
  buildFacebookMiningRunConfig,
  resolveTerminalRunStatus,
} from "./facebook-product-video-mining.result.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";
import {
  createFacebookProductVideoMiningStorage,
} from "./facebook-product-video-mining.storage.js";
import { runFacebookMiningRound } from "./facebook-product-video-mining.round.js";
import { logFacebookMiningFlow } from "./facebook-product-video-mining.logging.js";
import { focusExistingFacebookVideoTab } from "./facebook-product-video-mining.chrome-tabs.js";

type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];
type FacebookProductVideoMiningRun = ReturnType<typeof buildFacebookMiningRunConfig>;

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;
const FACEBOOK_BROWSER_SESSION_REF = "facebook-browser-session";

type FacebookFeedVideoWaitResult = {
  ready: boolean;
  reason: string | null;
  stableSampleCount: number;
  currentSrcHash: string;
};

export type FacebookProductVideoMiningContext = {
  browser: BrowserController;
  videoDownload: VideoDownloadAbilityGroup;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
};

const handleMissionOpenFailure = (input: {
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  runtimeLogger: RuntimeLogger;
  run: ReturnType<typeof buildFacebookMiningRunConfig>;
  reason: string;
}): FacebookProductVideoMiningRunStatus => {
  const failedRun = input.storage.updateRunProgress({
    runId: input.run.runId,
    status: "failed",
    failureReason: input.reason,
    endedAt: new Date().toISOString(),
    currentRoundId: null,
    currentRoundIndex: null,
  });
  logFacebookMiningFlow({
    logger: input.runtimeLogger,
    eventType: RuntimeLogEventType.MISSION_STOPPED,
    runId: input.run.runId,
    missionId: input.run.missionId,
    status: "failed",
    reason: input.reason,
  });
  return failedRun;
};

const createFacebookMissionTraceContext = (run: FacebookProductVideoMiningRun): RuntimeTraceContext =>
  createMissionTrace({
    missionId: run.missionId,
    runId: run.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  });

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
      script: `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
const videos = Array.from(document.querySelectorAll("video")).filter((video) => {
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
});
const hasReadyVideo = videos.some((video) => video.readyState >= 1 || Boolean(video.currentSrc || video.getAttribute("src")));
const currentSrc = String(videos[0]?.currentSrc || videos[0]?.getAttribute("src") || "");
const currentSrcHash = String(currentSrc.length);
const blockerText = /login|log in|sign in|captcha|verify|verification|2fa|two-factor/i.test(bodyText) ? bodyText.slice(0, 240) : null;
return {hasVideo: hasReadyVideo, blockerText, currentSrcHash};
`,
    });
    stableSampleCount += 1;
    if (state.blockerText) {
      return {
        ready: false,
        reason: "facebook_feed_blocked_before_video_ready",
        stableSampleCount,
        currentSrcHash: state.currentSrcHash,
      };
    }
    if (state.hasVideo) {
      return {
        ready: true,
        reason: null,
        stableSampleCount,
        currentSrcHash: state.currentSrcHash,
      };
    }
    await input.browser.wait(300);
  }
  return {
    ready: false,
    reason: "facebook_video_not_ready_after_open",
    stableSampleCount,
    currentSrcHash: "0",
  };
};

const openFacebookMiningFeed = async (input: {
  browser: BrowserController;
  run: FacebookProductVideoMiningRun;
  runtimeLogger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
}): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const openFeedStage = stageLogger.start({
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
      payload: {
        recoveryTrail: "facebook-open-feed-recovery-trail",
        action: "open_facebook_feed",
        beforeHash: "open-feed-before",
        afterHash: "open-feed-after",
      },
    });
    return { ok: false, reason: openResult.message };
  }
  openFeedStage.complete({
    durationMs: 0,
    refs: { browserSessionRef: FACEBOOK_BROWSER_SESSION_REF },
  });

  const waitStage = stageLogger.start({
    context: input.traceContext,
    stageName: "FACEBOOK_WAIT_VIDEO_STABLE",
    modeVisibility: ["DEBUG", "TRACE"],
  });
  const waitResult = await waitForFacebookFeedVideo({
    browser: input.browser,
    maxWaitMs: Math.min(20_000, input.run.maxMinutes * 60_000),
  });
  if (!waitResult.ready) {
    if (waitResult.reason === "facebook_feed_blocked_before_video_ready") {
      waitStage.fail({
        reason: waitResult.reason,
        failureClass: RuntimeFailureClass.ACCOUNT_SECURITY_BLOCKER,
        retryable: true,
        terminal: false,
        recoveryPolicy: "review_required",
        hashes: { currentSrcHash: waitResult.currentSrcHash },
        metrics: { stableSampleCount: waitResult.stableSampleCount },
        payload: {
          recoveryTrail: "facebook-open-feed-recovery-trail",
          action: "wait_video_stable",
          beforeHash: "open-feed-before",
          afterHash: "open-feed-after",
        },
      });
    } else if (waitResult.reason === "facebook_video_not_ready_after_open") {
      waitStage.fail({
        reason: waitResult.reason,
        failureClass: RuntimeFailureClass.PLATFORM_RATE_LIMIT,
        retryable: true,
        terminal: false,
        recoveryPolicy: "review_required",
        hashes: { currentSrcHash: waitResult.currentSrcHash },
        metrics: { stableSampleCount: waitResult.stableSampleCount },
        payload: {
          recoveryTrail: "facebook-open-feed-recovery-trail",
          action: "wait_video_stable",
          beforeHash: "open-feed-before",
          afterHash: "open-feed-after",
        },
      });
    } else {
      waitStage.fail({
        reason: waitResult.reason ?? "facebook_wait_video_probe_failed",
        failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE,
        retryable: true,
        terminal: false,
        recoveryPolicy: "review_required",
        hashes: { currentSrcHash: waitResult.currentSrcHash },
        metrics: { stableSampleCount: waitResult.stableSampleCount },
        payload: {
          recoveryTrail: "facebook-open-feed-recovery-trail",
          action: "wait_video_stable",
          beforeHash: "open-feed-before",
          afterHash: "open-feed-after",
        },
      });
    }
    return { ok: false, reason: waitResult.reason ?? "facebook_wait_video_probe_failed" };
  }
  waitStage.complete({
    durationMs: 0,
    hashes: { currentSrcHash: waitResult.currentSrcHash },
    metrics: { stableSampleCount: waitResult.stableSampleCount },
  });
  return { ok: true };
};

const runFacebookMiningRounds = async (input: {
  context: FacebookProductVideoMiningContext;
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  run: ReturnType<typeof buildFacebookMiningRunConfig>;
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

const finalizeFacebookMiningMission = (input: {
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  runtimeLogger: RuntimeLogger;
  run: ReturnType<typeof buildFacebookMiningRunConfig>;
  terminalReason: string | null;
  startedAt: number;
}): FacebookProductVideoMiningRunStatus => {
  const latest = input.storage.getRunStatus(input.run.runId);
  const elapsedMinutes = (Date.now() - input.startedAt) / 60_000;
  const finalStatus = resolveTerminalRunStatus({
    savedProductCount: latest?.savedProductCount ?? 0,
    targetProductCount: input.run.targetProductCount,
    timedOut: elapsedMinutes >= input.run.maxMinutes,
    maxRoundsReached: (latest?.scannedCount ?? 0) >= input.run.maxRounds,
    reviewRequired: Boolean(input.terminalReason),
    failed: false,
  });
  const finalFailureReason = finalStatus === "completed" ? null : input.terminalReason;
  const finalRun = input.storage.updateRunProgress({
    runId: input.run.runId,
    status: finalStatus,
    failureReason: finalFailureReason,
    endedAt: new Date().toISOString(),
    currentRoundId: null,
    currentRoundIndex: null,
  });
  logFacebookMiningFlow({
    logger: input.runtimeLogger,
    eventType: finalStatus === "completed" ? RuntimeLogEventType.MISSION_COMPLETED : finalStatus === "review_required" ? RuntimeLogEventType.MISSION_REVIEW_REQUIRED : RuntimeLogEventType.MISSION_STOPPED,
    runId: input.run.runId,
    missionId: input.run.missionId,
    status: finalStatus === "completed" ? "success" : finalStatus === "review_required" ? "review_required" : "skipped",
    reason: input.terminalReason ?? finalStatus,
  });
  return finalRun;
};

export const runFacebookProductVideoMiningMission = async (
  run: FacebookProductVideoMiningRun,
  context: FacebookProductVideoMiningContext,
): Promise<FacebookProductVideoMiningRunStatus> => {
  const storage = createFacebookProductVideoMiningStorage(context.dataDir);
  const missionTrace = createFacebookMissionTraceContext(run);
  const stageLogger = createStageLogger({ logger: context.runtimeLogger });
  try {
    const preflightStage = stageLogger.start({
      context: missionTrace,
      stageName: "FACEBOOK_MISSION_PREFLIGHT",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      refs: { debugBundleRef: `facebook-debug-bundle-${run.runId}` },
      hashes: { configHash: `${run.providerKind}:${run.targetProductCount}:${run.maxRounds}:${run.maxMinutes}` },
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
        schemaFailureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
        fallbackFailureClass: RuntimeFailureClass.INTERNAL_BUG,
      },
    });
    storage.updateRunProgress({
      runId: run.runId,
      status: "running",
      currentRoundId: null,
      currentRoundIndex: null,
    });
    preflightStage.complete({
      durationMs: 0,
      refs: { debugBundleRef: `facebook-debug-bundle-${run.runId}` },
      hashes: { configHash: `${run.providerKind}:${run.targetProductCount}:${run.maxRounds}:${run.maxMinutes}` },
      metrics: {
        targetProductCount: run.targetProductCount,
        maxRounds: run.maxRounds,
        maxMinutes: run.maxMinutes,
      },
      payload: {
        schemaFailureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
        fallbackFailureClass: RuntimeFailureClass.INTERNAL_BUG,
        recoveryTrail: "facebook-open-feed-recovery-trail",
        action: "mission_preflight",
        beforeHash: "mission-preflight-before",
        afterHash: "mission-preflight-after",
      },
    });
    logFacebookMiningFlow({ logger: context.runtimeLogger, eventType: RuntimeLogEventType.MISSION_STARTED, runId: run.runId, missionId: run.missionId, status: "started" });
    const openResult = await openFacebookMiningFeed({
      browser: context.browser,
      run,
      runtimeLogger: context.runtimeLogger,
      traceContext: missionTrace,
    });
    if (!openResult.ok) {
      return handleMissionOpenFailure({
        storage,
        runtimeLogger: context.runtimeLogger,
        run,
        reason: openResult.reason,
      });
    }
    const started = Date.now();
    const terminalReason = await runFacebookMiningRounds({ context, storage, run });
    return finalizeFacebookMiningMission({
      storage,
      runtimeLogger: context.runtimeLogger,
      run,
      terminalReason,
      startedAt: started,
    });
  } finally {
    storage.close();
  }
};
