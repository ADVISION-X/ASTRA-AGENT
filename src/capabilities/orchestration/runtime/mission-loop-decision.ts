import type { OrchestrationChildrenContext } from "../children-context.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import { cleanupRoundScreenshotArtifacts, type ScreenshotCleanupKind } from "./mission-loop-artifacts.js";
import type { RoundScreenContext } from "./mission-loop-screen.js";
import { applyMissionStatus, now, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";

type DecisionInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  aiOutput: VisualMissionActionPlanOutput;
  evidenceSaved: boolean;
  screen: RoundScreenContext;
};

const cleanupForDecision = async (input: DecisionInput, cleanupKind: ScreenshotCleanupKind): Promise<void> => {
  await cleanupRoundScreenshotArtifacts({
    ctx: input.ctx,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    cleanupKind,
    originalScreenshotRef: input.screen.originalScreenshotRef,
    coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
    extraTransientScreenshotRefs: input.screen.aiTransientScreenshotRefs,
    deleteOriginalScreenshot: !input.evidenceSaved,
  });
};

const completeMission = (missionId: string, stopReason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "completed",
    stopReason,
    endedAt: now(),
  }));
  setActiveMission(null);
};

const requireReview = (missionId: string, reason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "review_required",
    reviewRequiredReason: reason,
  }));
};

export const stopForTerminalAiDecision = async (input: DecisionInput): Promise<boolean> => {
  if (input.aiOutput.decision === "done") {
    await cleanupForDecision(input, "done");
    completeMission(input.missionId, input.aiOutput.doneReason ?? "AI marked mission done");
    return true;
  }
  if (input.aiOutput.decision === "review_required") {
    await cleanupForDecision(input, "review_required");
    requireReview(input.missionId, input.aiOutput.reviewRequiredReason ?? "AI requested review");
    return true;
  }
  if (input.aiOutput.decision === "blocked") {
    await cleanupForDecision(input, "blocked");
    requireReview(input.missionId, input.aiOutput.reviewRequiredReason ?? "AI blocked the mission");
    return true;
  }
  return false;
};

export const failMissingNextAction = async (input: DecisionInput): Promise<void> => {
  await cleanupForDecision(input, "dispatch_failed");
  upsertMissionState(applyMissionStatus(getMissionState(input.missionId), {
    status: "failed",
    failureReason: "AI decision act did not include nextAction",
  }));
  setActiveMission(null);
};
