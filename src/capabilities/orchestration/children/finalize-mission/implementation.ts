import type { OrchestrationChildCapability } from "../../internal.js";
import type { FinalizeMissionChildInput, FinalizeMissionChildOutput, MissionState } from "../../contract.js";
import { buildFailureExecuteResult, buildStateBackedExecuteResult } from "../../runtime/orchestration-execute-result.js";
import { buildMissionStateUpdate } from "../../runtime/orchestration-result-builder.js";
import type { OrchestrationRuntimeContext } from "../../runtime/orchestration-runtime-context.js";

function buildMissingFinalizeMissionResult(input: FinalizeMissionChildInput, now: string): FinalizeMissionChildOutput {
  return buildFailureExecuteResult({
    missionId: input.missionId,
    requestedPlatform: null,
    humanGoal: null,
    childCapabilityId: "finalize-mission",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    failureReason: `Mission ${input.missionId} not found for finalize-mission.`,
    internalOperationKind: "finalize-mission",
  });
}

function buildFinalizedMissionState(input: FinalizeMissionChildInput, state: MissionState, now: string) {
  return buildMissionStateUpdate({
    ...state,
    status: input.status,
    endedAt: now,
    updatedAt: now,
    stateRevision: (state.stateRevision ?? 0) + 1,
  });
}

async function executeFinalizeMission(input: FinalizeMissionChildInput, context: OrchestrationRuntimeContext): Promise<FinalizeMissionChildOutput> {
  const now = context.clock.now().isoTimestamp;
  const state = await context.statePort.getMissionState(input.missionId);
  if (!state) {
    return buildMissingFinalizeMissionResult(input, now);
  }
  const nextState = buildFinalizedMissionState(input, state, now);
  await context.statePort.putMissionState(nextState);
  return buildStateBackedExecuteResult({
    state: nextState,
    childCapabilityId: "finalize-mission",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    idempotencyKey: `finalize-mission:${input.missionId}:${nextState.stateRevision}`,
    failureReason: input.status === "failed" ? nextState.failureReason : null,
    reviewRequiredReason: input.status === "review_required" ? nextState.reviewRequiredReason : null,
    stateDecision: "finalized",
    internalOperationKind: "finalize-mission",
  });
}

export function createFinalizeMissionCapability(): OrchestrationChildCapability<FinalizeMissionChildInput, FinalizeMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "finalize-mission",
    execute: executeFinalizeMission,
  };
}
