import { randomUUID } from "node:crypto";
import type { OrchestrationChildrenContext } from "../children-context.js";
import {
  getMissionState,
  upsertMissionState,
  applyMissionStatus,
  setActiveMission,
  now,
} from "./mission-state.js";
import { checkLoopGuardBeforeRound, checkLoopGuardAfterRound } from "./loop-guard.js";
import { loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog.js";
import { runMissionRound } from "./mission-loop-round.js";

const roundDelayMs = 2500;

export async function runMissionRoundLoop(
  missionId: string,
  ctx: OrchestrationChildrenContext,
): Promise<void> {
  const catalog = loadMuscleMemoryCatalog();

  while (true) {
    const state = getMissionState(missionId);
    const guardBefore = checkLoopGuardBeforeRound(state);
    if (guardBefore.shouldStop) {
      completeMissionIfRunning(missionId, state.activeRunId ?? state.runId ?? missionId, guardBefore.reason, ctx);
      return;
    }

    const runId = state.activeRunId ?? state.runId;
    const roundId = randomUUID();
    const sessionId = "local";
    const roundResult = await runMissionRound({ missionId, runId, roundId, sessionId, state, ctx, catalog });
    if (roundResult === "stop") return;
    const stateAfter = getMissionState(missionId);
    const guardAfter = checkLoopGuardAfterRound(stateAfter);
    if (guardAfter.shouldStop) {
      completeMissionIfRunning(missionId, runId, guardAfter.reason, ctx);
      return;
    }
    completeRound(missionId, runId, roundId, ctx);
    await new Promise<void>(resolve => setTimeout(resolve, roundDelayMs));
  }
}

const completeMissionIfRunning = (
  missionId: string,
  runId: string,
  reason: string,
  ctx: OrchestrationChildrenContext,
): void => {
  if (reason === "mission-not-running") return;
  const finalized = applyMissionStatus(getMissionState(missionId), { status: "completed", stopReason: reason, endedAt: now() });
  upsertMissionState(finalized);
  setActiveMission(null);
  ctx.runtimeLogger.emit({
    traceId: missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "MISSION_COMPLETED",
    owner: "orchestration",
    missionId,
    runId,
    status: "success",
    reason: `Mission completed: ${reason}`,
  });
};

const completeRound = (
  missionId: string,
  runId: string,
  roundId: string,
  ctx: OrchestrationChildrenContext,
): void => {
  const current = getMissionState(missionId);
  upsertMissionState({ ...current, roundIndex: (current.roundIndex ?? 0) + 1 });
  ctx.runtimeLogger.emit({
    traceId: missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "ROUND_COMPLETED",
    owner: "orchestration",
    missionId,
    runId,
    roundId,
    status: "success",
    reason: "Round completed",
  });
};
