import type { OrchestrationChildrenContext } from "../children-context.js";
import type { MissionState } from "../contract.js";
import { runProductVideoDomRoundRuntime } from "../../../plugins/product-video-dom-runtime/product-video-dom-round.js";
import {
  applyMissionStatus,
  getMissionState,
  now,
  setActiveMission,
  upsertMissionState,
} from "./mission-state.js";
import type { RoundResult } from "./mission-loop-round.js";

type ProductVideoDomRoundInput = {
  missionId: string;
  runId: string;
  roundId: string;
  state: MissionState;
  ctx: OrchestrationChildrenContext;
};

type ProductVideoDomRuntimeResult = Awaited<ReturnType<typeof runProductVideoDomRoundRuntime>>;

const failDomRound = (missionId: string, failureReason: string): RoundResult => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "stopped",
    stopReason: failureReason,
    endedAt: now(),
  }));
  setActiveMission(null);
  return "stop";
};

const reviewDomRound = (missionId: string, reason: string): RoundResult => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "review_required",
    reviewRequiredReason: reason,
  }));
  setActiveMission(null);
  return "stop";
};

const emitDomRoundStarted = (input: ProductVideoDomRoundInput): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "ROUND_STARTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "started",
    reason: `DOM product-video round ${input.state.roundIndex ?? 0} started`,
  });
};

const resolveProductVideoPageUrl = (state: MissionState): string | null =>
  state.productVideoPageUrl ?? state.targetUrl ?? null;

const buildDomRuntimeInput = (
  input: ProductVideoDomRoundInput,
  productVideoPageUrl: string,
) => ({
  browser: input.ctx.browserController,
  dataDir: input.ctx.dataDir,
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId,
  roundIndex: input.state.roundIndex ?? 0,
  platformId: input.state.requestedPlatform ?? "unknown",
  productVideoPageUrl,
  userRequirementText: input.state.humanGoal ?? "Find product-seeding videos.",
  consecutiveAdvanceFailures: input.state.domConsecutiveAdvanceFailures ?? 0,
});

const continueDomRound = (
  input: ProductVideoDomRoundInput,
  result: ProductVideoDomRuntimeResult,
): RoundResult => {
  const current = getMissionState(input.missionId);
  upsertMissionState({
    ...applyMissionStatus(current, { status: "running" }),
    matchedEvidenceCount: (current.matchedEvidenceCount ?? 0) + (result.savedRecord ? 1 : 0),
    domConsecutiveAdvanceFailures: result.advanceFailureCount,
    lastActionStatus: "success",
    lastFailureReason: null,
    lastReviewRequiredReason: null,
    reviewRequiredReason: null,
    stopReason: null,
    failureReason: null,
  });
  return "continue";
};

const resolveDomRoundResult = (
  input: ProductVideoDomRoundInput,
  result: ProductVideoDomRuntimeResult,
): RoundResult => {
  if (result.roundResult.status === "review_required") {
    return reviewDomRound(input.missionId, result.roundResult.reason);
  }
  if (result.roundResult.status === "stop") {
    return failDomRound(input.missionId, result.roundResult.reason);
  }
  return continueDomRound(input, result);
};

export const runProductVideoDomRound = async (
  input: ProductVideoDomRoundInput,
): Promise<RoundResult> => {
  emitDomRoundStarted(input);
  const productVideoPageUrl = resolveProductVideoPageUrl(input.state);
  if (!productVideoPageUrl) {
    return failDomRound(input.missionId, "DOM product-video mode requires productVideoPageUrl.");
  }
  const result = await runProductVideoDomRoundRuntime(buildDomRuntimeInput(input, productVideoPageUrl));
  return resolveDomRoundResult(input, result);
};
