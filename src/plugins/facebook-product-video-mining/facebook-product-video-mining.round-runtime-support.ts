import {
  RuntimeLogEventType,
  createMissionTrace,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import type { VideoDownloadResult } from "../../capabilities/video-download/index.js";
import {
  handleAcceptedJudgment,
  handleRejectedJudgment,
  handleProbeFailure,
  type FacebookDecisionApplySummary,
} from "./facebook-product-video-mining.round-outcomes.js";
import { logFacebookMiningFlow } from "./facebook-product-video-mining.logging.js";
import {
  navigateToNextFacebookVideo,
  type FacebookMiningRoundOutcome,
} from "./facebook-product-video-mining.navigation.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";
import type {
  FacebookMiningRoundArtifacts,
  FacebookMiningRoundContext,
  FacebookMiningRoundResolution,
  FacebookMiningRoundStageResult,
} from "./facebook-product-video-mining.round-runtime.js";

type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;

export type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
};

export const createFacebookRoundTrace = (context: FacebookMiningRoundContext) => withRoundTrace({
  context: createMissionTrace({
    missionId: context.input.run.missionId,
    runId: context.input.run.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  }),
  roundId: context.round.roundId,
});

export const isSuccessfulVideoDownload = (
  result: VideoDownloadResult,
): result is SuccessfulVideoDownload => result.status === "success" && result.output.status === "success";

export const continueFacebookMiningRound = <Value>(value: Value): FacebookMiningRoundStageResult<Value> => ({
  ok: true,
  value,
});

export const stopFacebookMiningRound = (
  outcome: FacebookMiningRoundOutcome,
): FacebookMiningRoundStageResult<never> => ({ ok: false, outcome });

export const buildProbeFailureStageResult = (input: {
  context: FacebookMiningRoundContext;
  probe: FacebookVideoDomProbeResult;
}): FacebookMiningRoundStageResult<never> => stopFacebookMiningRound(handleProbeFailure({
  storage: input.context.input.storage,
  missionId: input.context.input.run.missionId,
  runId: input.context.input.run.runId,
  roundId: input.context.round.roundId,
  roundIndex: input.context.input.roundIndex,
  probe: input.probe,
  failureContract: {
    failureClass: input.probe.status === "failed" ? "INTERNAL_BUG" : "SKIPPABLE_ROUND_FAILURE",
    recoveryPolicy: "skip_round",
    recoveryTrail: "facebook-round-runtime-recovery-trail",
    action: "handle_probe_failure",
    beforeHash: "round-runtime-before",
    afterHash: "round-runtime-after",
    durationMs: 0,
    terminal: input.probe.status === "login_required"
      || input.probe.status === "captcha_or_2fa_required"
      || input.probe.blocker === "facebook_rate_limited",
    reason: input.probe.blocker ?? input.probe.status,
  },
}));

export const saveAcceptedFacebookMiningRound = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<FacebookDecisionApplySummary> => {
  return handleAcceptedJudgment({
    videoDownload: input.context.input.videoDownload,
    runtimeLogger: input.context.input.runtimeLogger,
    dataDir: input.context.input.dataDir,
    storage: input.context.input.storage,
    missionId: input.context.input.run.missionId,
    runId: input.context.input.run.runId,
    roundId: input.context.round.roundId,
    roundIndex: input.context.input.roundIndex,
    probe: input.resolution.probe,
    comments: input.resolution.comments,
    download: input.resolution.download,
    judgment: input.resolution.judgment,
  });
};

export const saveRejectedFacebookMiningRound = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<FacebookDecisionApplySummary> => {
  return handleRejectedJudgment({
    browser: input.context.input.browser,
    videoDownload: input.context.input.videoDownload,
    runtimeLogger: input.context.input.runtimeLogger,
    storage: input.context.input.storage,
    notInterestedEnabled: input.context.input.run.notInterestedEnabled,
    missionId: input.context.input.run.missionId,
    runId: input.context.input.run.runId,
    roundId: input.context.round.roundId,
    roundIndex: input.context.input.roundIndex,
    probe: input.resolution.probe,
    comments: input.resolution.comments,
    download: input.resolution.download,
    judgment: input.resolution.judgment,
  });
};

export const completeFacebookMiningRound = (
  context: FacebookMiningRoundContext,
): Promise<FacebookMiningRoundOutcome> => {
  logFacebookMiningFlow({
    logger: context.input.runtimeLogger,
    eventType: RuntimeLogEventType.ROUND_COMPLETED,
    runId: context.input.run.runId,
    missionId: context.input.run.missionId,
    roundId: context.round.roundId,
    status: "success",
  });
  return navigateToNextFacebookVideo({
    browser: context.input.browser,
    logger: context.input.runtimeLogger,
    runId: context.input.run.runId,
    missionId: context.input.run.missionId,
    roundId: context.round.roundId,
    feedEntryUrl: context.input.run.feedEntryUrl,
  });
};
