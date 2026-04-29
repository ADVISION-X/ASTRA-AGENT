import type { OrchestrationChildCapability, EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput } from "../../contract.js";
import { MissionStepResultSchema } from "../../schema.js";

export function createEvaluateStepTransitionCapability(): OrchestrationChildCapability<EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "evaluate-step-transition",
    async execute(input, context) {
      const state = await context.statePort.getMissionState(input.missionId);
      return MissionStepResultSchema.parse({
        status: state.status === "review_required" ? "review_required" : state.status === "failed" ? "failed" : "success",
        missionId: state.missionId ?? input.missionId,
        mapId: state.mapId ?? "human-review",
        stepId: state.currentStepId ?? "finalize-mission",
        childCapabilityId: state.currentStepId ?? "finalize-mission",
        targetAbilityGroupId: null,
        envelopeId: state.lastEnvelopeId,
        resultRef: state.lastResultRef,
        outputRef: state.lastRuntimeProofRef,
        decision: null,
        failureReason: state.failureReason,
        reviewRequiredReason: state.reviewRequiredReason,
        transitionId: null,
        nextStepId: state.currentStepId,
        payloadRefs: state.payloadRefs,
      });
    },
  };
}
