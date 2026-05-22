import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createStageLogger,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";
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
  type FacebookDecisionApplySummary,
} from "./facebook-product-video-mining.round-outcomes.js";
import { logFacebookMiningFlow } from "./facebook-product-video-mining.logging.js";
import { type FacebookMiningRoundOutcome } from "./facebook-product-video-mining.navigation.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";
import {
  createFacebookRoundTrace,
  isSuccessfulVideoDownload,
  continueFacebookMiningRound,
  stopFacebookMiningRound,
  buildProbeFailureStageResult,
  saveAcceptedFacebookMiningRound,
  saveRejectedFacebookMiningRound,
  completeFacebookMiningRound,
  type SuccessfulVideoDownload,
} from "./facebook-product-video-mining.round-runtime-support.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];

const FACEBOOK_MINING_ROUND_STATE_MACHINE = [
  "WAIT_VIDEO_STABLE",
  "SNAPSHOT_PAGE_FACTS",
  "LOAD_COMMENTS",
  "DOWNLOAD_VIDEO",
  "AI_JUDGE",
  "RECORD_RESULT",
  "OPTIONAL_NOT_INTERESTED",
  "ADVANCE_VIDEO",
  "VERIFY_NEW_VIDEO",
  "NEXT_ROUND",
] as const;

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

const buildRoundSummaryRef = (context: FacebookMiningRoundContext) => ({ roundSummaryRef: context.round.roundId });

const buildRoundFinalizePayload = () => ({
  recoveryTrail: "facebook-round-runtime-recovery-trail",
  action: "handle_probe_failure",
  beforeHash: "round-runtime-before",
  afterHash: "round-runtime-after",
});

const buildProbeRoundInput = (context: FacebookMiningRoundContext) => ({
  browser: context.input.browser,
  runtimeLogger: context.input.runtimeLogger,
  missionId: context.input.run.missionId,
  runId: context.input.run.runId,
  roundId: context.round.roundId,
  roundIndex: context.input.roundIndex,
});

const startFacebookMiningRound = (context: FacebookMiningRoundContext): void => {
  const stageLogger = createStageLogger({ logger: context.input.runtimeLogger });
  const roundTrace = createFacebookRoundTrace(context);
  const roundStartStage = stageLogger.start({
    context: roundTrace,
    stageName: "FACEBOOK_ROUND_START",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    metrics: { roundIndex: context.round.roundIndex },
  });
  logFacebookMiningFlow({
    logger: context.input.runtimeLogger,
    eventType: RuntimeLogEventType.ROUND_STARTED,
    runId: context.input.run.runId,
    missionId: context.input.run.missionId,
    roundId: context.round.roundId,
    status: "started",
    reason: FACEBOOK_MINING_ROUND_STATE_MACHINE[0],
  });
  context.input.storage.updateRunProgress({
    runId: context.input.run.runId,
    status: "running",
    currentRoundId: context.round.roundId,
    currentRoundIndex: context.round.roundIndex,
  });
  roundStartStage.complete({ durationMs: 0, metrics: { roundIndex: context.round.roundIndex } });
};

const probeFacebookMiningRound = async (
  context: FacebookMiningRoundContext,
): Promise<FacebookMiningRoundStageResult<Awaited<ReturnType<typeof probeCurrentFacebookVideo>>>> => {
  const stageLogger = createStageLogger({ logger: context.input.runtimeLogger });
  const roundTrace = createFacebookRoundTrace(context);
  const finalizeStage = stageLogger.start({
    context: roundTrace,
    stageName: "FACEBOOK_ROUND_FINALIZE",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    refs: buildRoundSummaryRef(context),
  });
  const roundSummaryRef = buildRoundSummaryRef(context);
  const roundFinalizePayload = buildRoundFinalizePayload();
  const probe = await probeCurrentFacebookVideo(buildProbeRoundInput(context));
  if (probe.status !== "success") {
    if (probe.status === "failed") {
      finalizeStage.fail({
        reason: probe.status,
        failureClass: RuntimeFailureClass.INTERNAL_BUG,
        retryable: false,
        terminal: false,
        recoveryPolicy: "skip_round",
        refs: roundSummaryRef,
        payload: roundFinalizePayload,
      });
    } else {
      finalizeStage.fail({
        reason: probe.status,
        failureClass: RuntimeFailureClass.SKIPPABLE_ROUND_FAILURE,
        retryable: false,
        terminal: false,
        recoveryPolicy: "skip_round",
        refs: roundSummaryRef,
        payload: roundFinalizePayload,
      });
    }
    return buildProbeFailureStageResult({ context, probe });
  }
  return continueFacebookMiningRound(probe);
};

const applyFacebookMiningRoundDecision = async (input: {
  context: FacebookMiningRoundContext;
  resolution: FacebookMiningRoundResolution;
}): Promise<void> => {
  const stageLogger = createStageLogger({ logger: input.context.input.runtimeLogger });
  const decisionStage = stageLogger.start({
    context: createFacebookRoundTrace(input.context),
    stageName: "FACEBOOK_DECISION_APPLY",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
  });
  let summary: FacebookDecisionApplySummary;
  if (input.resolution.judgment.selectedOptionId === "PRODUCT_SEEDING") {
    summary = await saveAcceptedFacebookMiningRound(input);
  } else {
    summary = await saveRejectedFacebookMiningRound(input);
  }
  decisionStage.complete({
    durationMs: 0,
    refs: { candidateId: summary.candidateId },
    metrics: { confidence: summary.confidence ?? 0 },
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
