import type { OrchestrationChildrenContext } from "../children-context.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import { cleanupRoundScreenshotArtifacts } from "./mission-loop-artifacts.js";
import type { RoundScreenContext } from "./mission-loop-screen.js";
import { systemSaveCurrentRoundEvidence } from "./mission-loop-evidence.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";

type SaveInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  userRequirementText: string;
  aiResultRef: string | null;
  aiOutput: VisualMissionActionPlanOutput;
  screen: RoundScreenContext;
};

const emitSaved = (input: SaveInput, recordRef: string | null | undefined): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "FORENSICS_RECORD_APPENDED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "success",
    reason: `system saved current round evidence ref=${recordRef ?? "unknown"}`,
  });
};

const markSaveFailure = (missionId: string, reason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: reason }));
  setActiveMission(null);
};

export const saveRoundEvidenceIfRequested = async (input: SaveInput): Promise<boolean | null> => {
  if (!input.aiOutput.save) return false;
  const saveResult = await systemSaveCurrentRoundEvidence({
    ctx: input.ctx,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    userRequirementText: input.userRequirementText,
    originalScreenshotRef: input.screen.originalScreenshotRef,
    coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
    gridSpecRef: input.screen.gridSpecRef,
    aiResultRef: input.aiResultRef,
    saveReason: input.aiOutput.saveReason,
    confidence: input.aiOutput.confidence,
    visualEvidence: input.aiOutput.visualEvidence,
  });
  if (saveResult.status !== "success") {
    await cleanupRoundScreenshotArtifacts({
      ctx: input.ctx,
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId,
      cleanupKind: "dispatch_failed",
      originalScreenshotRef: input.screen.originalScreenshotRef,
      coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
      extraTransientScreenshotRefs: input.screen.aiTransientScreenshotRefs,
      deleteOriginalScreenshot: true,
    });
    markSaveFailure(input.missionId, saveResult.failureReason ?? "system evidence save failed");
    return null;
  }
  upsertMissionState({ ...getMissionState(input.missionId), matchedEvidenceCount: (getMissionState(input.missionId).matchedEvidenceCount ?? 0) + 1 });
  emitSaved(input, saveResult.recordRef);
  return true;
};
