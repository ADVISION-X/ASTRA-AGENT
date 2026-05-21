import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { VideoDownloadAbilityGroup, VideoDownloadResult } from "../../capabilities/video-download/index.js";
import type { FacebookCommentCollectionResult } from "./facebook-product-video-mining.comments.js";
import { probeCurrentFacebookVideo } from "./facebook-product-video-mining.dom-probe.js";
import {
  buildFacebookMiningRoundState,
  buildFacebookMiningRunConfig,
} from "./facebook-product-video-mining.result.js";
import {
  handleAcceptedJudgment,
  handleProbeFailure,
  handleRejectedJudgment,
} from "./facebook-product-video-mining.round-outcomes.js";
import {
  logFacebookMiningFlow,
  navigateToNextFacebookVideo,
  type FacebookMiningRoundOutcome,
} from "./facebook-product-video-mining.round-support.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];

export type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
};

export type FacebookMiningRoundInput = {
  browser: BrowserController;
  videoDownload: VideoDownloadAbilityGroup;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  storage: FacebookProductVideoMiningStorage;
  run: ReturnType<typeof buildFacebookMiningRunConfig>;
  roundIndex: number;
};

export type FacebookMiningRoundContext = {
  input: FacebookMiningRoundInput;
  round: ReturnType<typeof buildFacebookMiningRoundState>;
};

export type FacebookMiningRoundStageResult<Value> =
  | { ok: true; value: Value }
  | { ok: false; outcome: FacebookMiningRoundOutcome };

export type FacebookMiningRoundArtifacts = {
  probe: Awaited<ReturnType<typeof probeCurrentFacebookVideo>>;
  comments: FacebookCommentCollectionResult;
  download: SuccessfulVideoDownload;
};

export type FacebookMiningRoundResolution = FacebookMiningRoundArtifacts & {
  judgment: FacebookVideoAiJudgment;
};

const isSuccessfulVideoDownload = (
  result: VideoDownloadResult,
): result is SuccessfulVideoDownload => result.status === "success" && result.output.status === "success";

const continueFacebookMiningRound = <Value>(value: Value): FacebookMiningRoundStageResult<Value> => ({
  ok: true,
  value,
});

const stopFacebookMiningRound = (
  outcome: FacebookMiningRoundOutcome,
): FacebookMiningRoundStageResult<never> => ({ ok: false, outcome });

const startFacebookMiningRound = (context: FacebookMiningRoundContext): void => {
  logFacebookMiningFlow({
    logger: context.input.runtimeLogger,
    eventType: RuntimeLogEventType.ROUND_STARTED,
    runId: context.input.run.runId,
    missionId: context.input.run.missionId,
    roundId: context.round.roundId,
    status: "started",
  });
  context.input.storage.updateRunProgress({
    runId: context.input.run.runId,
    status: "running",
    currentRoundId: context.round.roundId,
    currentRoundIndex: context.round.roundIndex,
  });
};

const probeFacebookMiningRound = async (
  context: FacebookMiningRoundContext,
): Promise<FacebookMiningRoundStageResult<Awaited<ReturnType<typeof probeCurrentFacebookVideo>>>> => {
  const probe = await probeCurrentFacebookVideo({
    browser: context.input.browser,
    roundIndex: context.input.roundIndex,
  });
  if (probe.status !== "success") {
    return stopFacebookMiningRound(handleProbeFailure({
      storage: context.input.storage,
      missionId: context.input.run.missionId,
      runId: context.input.run.runId,
      roundId: context.round.roundId,
      roundIndex: context.input.roundIndex,
      probe,
    }));
  }
  return continueFacebookMiningRound(probe);
};

const saveAcceptedFacebookMiningRound = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<void> => {
  await handleAcceptedJudgment({
    videoDownload: input.context.input.videoDownload,
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

const saveRejectedFacebookMiningRound = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<void> => {
  await handleRejectedJudgment({
    browser: input.context.input.browser,
    videoDownload: input.context.input.videoDownload,
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

const applyFacebookMiningRoundDecision = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<void> => {
  if (input.resolution.judgment.selectedOptionId === "PRODUCT_SEEDING") {
    await saveAcceptedFacebookMiningRound(input);
    return;
  }
  await saveRejectedFacebookMiningRound(input);
};

const completeFacebookMiningRound = (
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

export const FacebookMiningRoundRuntime = {
  isSuccessfulVideoDownload,
  continueFacebookMiningRound,
  stopFacebookMiningRound,
  startFacebookMiningRound,
  probeFacebookMiningRound,
  applyFacebookMiningRoundDecision,
  completeFacebookMiningRound,
} as const;
