import type { OrchestrationChildCapability } from "../../internal.js";
import type { EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput } from "../../contract.js";
import { MissionStepResultSchema } from "../../schema.js";

export function createEvaluateStepTransitionCapability(): OrchestrationChildCapability<EvaluateStepTransitionChildInput, EvaluateStepTransitionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "evaluate-step-transition",
    async execute(input, context) {
      const state = await context.statePort.getMissionState(input.missionId);
      if (!state) {
        return MissionStepResultSchema.parse({
          status: "failed",
          missionId: input.missionId,
          mapId: "human-review",
          stepId: "evaluate-step-transition",
          childCapabilityId: "evaluate-step-transition",
          targetAbilityGroupId: null,
          failureReason: `Mission ${input.missionId} not found for evaluate-step-transition.`,
          payloadRefs: {},
        });
      }
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
    },
  };
}
