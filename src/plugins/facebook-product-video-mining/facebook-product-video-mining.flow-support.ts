import {
  RuntimeLogEventType,
  createMissionTrace,
  type RuntimeLogger,
  type RuntimeTraceContext,
} from "../../lib/runtime-logs/index.js";

import {
  buildFacebookMiningRunConfig,
  resolveTerminalRunStatus,
} from "./facebook-product-video-mining.result.js";
import {
  createFacebookProductVideoMiningStorage,
} from "./facebook-product-video-mining.storage.js";
import { logFacebookMiningFlow } from "./facebook-product-video-mining.logging.js";

type FacebookProductVideoMiningRunStatus = ReturnType<typeof buildFacebookMiningRunConfig> extends infer Run
  ? ReturnType<ReturnType<typeof createFacebookProductVideoMiningStorage>["updateRunProgress"]>
  : never;

type FacebookProductVideoMiningRun = ReturnType<typeof buildFacebookMiningRunConfig>;

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;

export const FACEBOOK_VIDEO_READY_DETECTOR_SCRIPT = `
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
`;

export const handleMissionOpenFailure = (input: {
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  runtimeLogger: RuntimeLogger;
  run: FacebookProductVideoMiningRun;
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

export const createFacebookMissionTraceContext = (run: FacebookProductVideoMiningRun): RuntimeTraceContext =>
  createMissionTrace({
    missionId: run.missionId,
    runId: run.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  });

export const markFacebookMiningMissionRunning = (input: {
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  run: FacebookProductVideoMiningRun;
}): void => {
  input.storage.updateRunProgress({
    runId: input.run.runId,
    status: "running",
    currentRoundId: null,
    currentRoundIndex: null,
  });
};

export const logFacebookMiningMissionStarted = (input: {
  runtimeLogger: RuntimeLogger;
  run: FacebookProductVideoMiningRun;
}): void => {
  logFacebookMiningFlow({
    logger: input.runtimeLogger,
    eventType: RuntimeLogEventType.MISSION_STARTED,
    runId: input.run.runId,
    missionId: input.run.missionId,
    status: "started",
  });
};

export const finalizeFacebookMiningMission = (input: {
  storage: ReturnType<typeof createFacebookProductVideoMiningStorage>;
  runtimeLogger: RuntimeLogger;
  run: FacebookProductVideoMiningRun;
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
