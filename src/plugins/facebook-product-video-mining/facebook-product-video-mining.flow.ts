import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
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

type FacebookProductVideoMiningMissionInput = FacebookProductVideoMiningContracts["FacebookProductVideoMiningMissionInput"];
type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];
type FacebookProductVideoMiningRun = ReturnType<typeof buildFacebookMiningRunConfig>;

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

const waitForFacebookFeedVideo = async (input: {
  browser: BrowserController;
  maxWaitMs: number;
}): Promise<void> => {
  const deadline = Date.now() + input.maxWaitMs;
  while (Date.now() < deadline) {
    const state = await input.browser.evaluateActiveTab<{
      hasVideo: boolean;
      blockerText: string | null;
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
const blockerText = /login|log in|sign in|captcha|verify|verification|2fa|two-factor/i.test(bodyText) ? bodyText.slice(0, 240) : null;
return {hasVideo: hasReadyVideo, blockerText};
`,
    });
    if (state.blockerText) {
      throw new Error("facebook_feed_blocked_before_video_ready");
    }
    if (state.hasVideo) {
      return;
    }
    await input.browser.wait(300);
  }
  throw new Error("facebook_video_not_ready_after_open");
};

const openFacebookMiningFeed = async (input: {
  browser: BrowserController;
  run: FacebookProductVideoMiningRun;
}): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const focusedExisting = await focusExistingFacebookVideoTab({ preferredUrl: null });
  const openResult = focusedExisting
    ? { ok: true, message: "focused existing Facebook video tab" }
    : await input.browser.open({ url: input.run.feedEntryUrl, title: "Facebook product video mining feed" });
  if (!openResult.ok) {
    return { ok: false, reason: openResult.message };
  }
  await waitForFacebookFeedVideo({
    browser: input.browser,
    maxWaitMs: Math.min(20_000, input.run.maxMinutes * 60_000),
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
    terminalReason = outcome.reason;
    if (outcome.terminal) {
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
  try {
    storage.updateRunProgress({
      runId: run.runId,
      status: "running",
      currentRoundId: null,
      currentRoundIndex: null,
    });
    logFacebookMiningFlow({ logger: context.runtimeLogger, eventType: RuntimeLogEventType.MISSION_STARTED, runId: run.runId, missionId: run.missionId, status: "started" });
    const openResult = await openFacebookMiningFeed({
      browser: context.browser,
      run,
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
