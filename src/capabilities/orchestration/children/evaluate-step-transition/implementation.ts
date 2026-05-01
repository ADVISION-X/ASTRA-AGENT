import type { OrchestrationChildCapability } from "../../internal.js";
import type { EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput, MissionState } from "../../contract.js";
import { MissionStepResultSchema } from "../../schema.js";
import { buildFailureExecuteResult, buildStateBackedExecuteResult } from "../../runtime/orchestration-execute-result.js";
import type { OrchestrationRuntimeContext } from "../../runtime/orchestration-runtime-context.js";

function buildMissingEvaluateStepTransitionResult(input: EvaluateStepTransitionChildInput, now: string): EvaluateStepTransitionChildOutput {
  return buildFailureExecuteResult({
    missionId: input.missionId,
    mapId: null,
    requestedPlatform: null,
    humanGoal: null,
    childCapabilityId: "evaluate-step-transition",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    failureReason: `Mission ${input.missionId} not found for evaluate-step-transition.`,
    internalOperationKind: "evaluate-step-transition",
  });
}

function buildEvaluateCurrentStepResult(input: EvaluateStepTransitionChildInput, state: MissionState) {
  return MissionStepResultSchema.parse({
    status: state.status === "review_required" ? "review_required" : state.status === "failed" ? "failed" : "success",
    missionId: state.missionId ?? input.missionId,
    mapId: state.mapId ?? "human-review",
    stepId: state.currentStepId ?? "finalize-mission",
    childCapabilityId: state.currentStepId ?? "finalize-mission",
    targetAbilityGroupId: null,
    envelopeId: state.lastEnvelopeId ?? null,
    resultRef: state.lastResultRef ?? null,
    outputRef: state.lastRuntimeProofRef ?? null,
    decision: null,
    failureReason: state.failureReason ?? null,
    reviewRequiredReason: state.reviewRequiredReason ?? null,
    transitionId: null,
    nextStepId: state.currentStepId ?? null,
    payloadRefs: state.payloadRefs,
  });
}

async function executeEvaluateStepTransition(input: EvaluateStepTransitionChildInput, context: OrchestrationRuntimeContext): Promise<EvaluateStepTransitionChildOutput> {
  const now = context.clock.now().isoTimestamp;
  const state = await context.statePort.getMissionState(input.missionId);
  if (!state) {
    return buildMissingEvaluateStepTransitionResult(input, now);
  }
  const currentStepResult = buildEvaluateCurrentStepResult(input, state);
  return buildStateBackedExecuteResult({
    state,
    childCapabilityId: "evaluate-step-transition",
    caller: "orchestration",
    startedAt: now,
    endedAt: now,
    idempotencyKey: `evaluate-step-transition:${input.missionId}:${state.stateRevision}`,
    currentStepResult,
    failureReason: currentStepResult.failureReason ?? null,
    reviewRequiredReason: currentStepResult.reviewRequiredReason ?? null,
    stateDecision: "updated",
    internalOperationKind: "evaluate-step-transition",
  });
}

export function createEvaluateStepTransitionCapability(): OrchestrationChildCapability<EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "evaluate-step-transition",
    execute: executeEvaluateStepTransition,
  };
}
