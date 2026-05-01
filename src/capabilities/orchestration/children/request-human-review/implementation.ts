import type { OrchestrationChildCapability } from "../../internal.js";
import type { MissionState, RequestHumanReviewChildInput, RequestHumanReviewChildOutput } from "../../contract.js";
import { buildFailureExecuteResult, buildStateBackedExecuteResult } from "../../runtime/orchestration-execute-result.js";
import { buildResumeCheckpointRef } from "../../runtime/orchestration-frozen-activation.js";
import { buildMissionStateUpdate } from "../../runtime/orchestration-result-builder.js";
import type { OrchestrationRuntimeContext } from "../../runtime/orchestration-runtime-context.js";

function buildMissingHumanReviewResult(input: RequestHumanReviewChildInput, now: string): RequestHumanReviewChildOutput {
  return buildFailureExecuteResult({
    missionId: input.missionId,
    mapId: null,
    requestedPlatform: null,
    humanGoal: null,
    childCapabilityId: "request-human-review",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    failureReason: `Mission ${input.missionId} not found for request-human-review.`,
    internalOperationKind: "request-human-review",
  });
}

function buildHumanReviewState(input: RequestHumanReviewChildInput, state: MissionState, now: string) {
  return buildMissionStateUpdate({
    ...state,
    status: "review_required",
    reviewRequiredReason: input.reason,
    resumeCheckpointRef: buildResumeCheckpointRef(state),
    updatedAt: now,
    endedAt: now,
    stateRevision: (state.stateRevision ?? 0) + 1,
  });
}

async function executeRequestHumanReview(input: RequestHumanReviewChildInput, context: OrchestrationRuntimeContext): Promise<RequestHumanReviewChildOutput> {
  const now = context.clock.now().isoTimestamp;
  const state = await context.statePort.getMissionState(input.missionId);
  if (!state) {
    return buildMissingHumanReviewResult(input, now);
  }
  const nextState = buildHumanReviewState(input, state, now);
  await context.statePort.putMissionState(nextState);
  return buildStateBackedExecuteResult({
    state: nextState,
    childCapabilityId: "request-human-review",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    idempotencyKey: `request-human-review:${input.missionId}:${nextState.stateRevision}`,
    reviewRequiredReason: input.reason,
    stateDecision: "updated",
    internalOperationKind: "request-human-review",
  });
}

export function createRequestHumanReviewCapability(): OrchestrationChildCapability<RequestHumanReviewChildInput, RequestHumanReviewChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "request-human-review",
    execute: executeRequestHumanReview,
  };
}
