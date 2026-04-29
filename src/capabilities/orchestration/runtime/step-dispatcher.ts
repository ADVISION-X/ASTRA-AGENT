import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";

export async function dispatchOperationalStep(input: {
  state: MissionState;
  map: OperationalMap;
  stepId: string;
  reason?: string;
  context: Pick<import("../contract.js").OrchestrationExecutionContext, "nerveBus">;
}) {
  const step = input.map.steps.find((candidate) => candidate.stepId === input.stepId);
  if (!step) {
    throw new Error(`Operational map ${input.map.mapId} is missing step ${input.stepId}.`);
  }

  if (step.stepKind === "review") {
    const reviewResult = await input.context.nerveBus.sendReviewRequestToCommander({
      missionId: input.state.missionId ?? "unknown-mission",
      mapId: input.map.mapId,
      stepId: step.stepId,
      reason: input.reason ?? input.state.reviewRequiredReason ?? "orchestration requires human review",
      payloadRefs: input.state.payloadRefs,
    });
    return MissionStepResultSchema.parse({
      status: reviewResult.status,
      missionId: input.state.missionId,
      mapId: input.map.mapId,
      stepId: step.stepId,
      childCapabilityId: step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: reviewResult.envelopeId,
      resultRef: reviewResult.resultRef,
      outputRef: reviewResult.payloadRefs.reviewReasonRef,
      decision: reviewResult.decision,
      failureReason: reviewResult.failureReason,
      reviewRequiredReason: input.reason ?? reviewResult.failureReason,
      payloadRefs: reviewResult.payloadRefs,
    });
  }

  if (step.stepKind === "finalize") {
    return MissionStepResultSchema.parse({
      status: "success",
      missionId: input.state.missionId,
      mapId: input.map.mapId,
      stepId: step.stepId,
      childCapabilityId: step.childCapabilityId,
      targetAbilityGroupId: null,
      payloadRefs: input.state.payloadRefs,
    });
  }

  const dispatchResult = step.stepKind === "ai"
    ? await input.context.nerveBus.sendRequestToAi({
        missionId: input.state.missionId ?? "unknown-mission",
        mapId: input.map.mapId,
        stepId: step.stepId,
        promptContractId: step.promptContractId ?? "missing.prompt.contract",
        payloadRefs: input.state.payloadRefs,
      })
    : await input.context.nerveBus.sendCommandToAbility({
        missionId: input.state.missionId ?? "unknown-mission",
        mapId: input.map.mapId,
        stepId: step.stepId,
        targetAbilityGroupId: step.targetAbilityGroupId && step.targetAbilityGroupId !== "ai"
          ? step.targetAbilityGroupId
          : "page-state",
        childCapabilityId: step.childCapabilityId,
        payloadRefs: input.state.payloadRefs,
      });

  return MissionStepResultSchema.parse({
    status: dispatchResult.status,
    missionId: input.state.missionId,
    mapId: input.map.mapId,
    stepId: step.stepId,
    childCapabilityId: step.childCapabilityId,
    targetAbilityGroupId: step.targetAbilityGroupId,
    envelopeId: dispatchResult.envelopeId,
    resultRef: dispatchResult.resultRef,
    outputRef: dispatchResult.payloadRefs.abilityResultRef ?? dispatchResult.payloadRefs.aiResultRef,
    decision: dispatchResult.decision,
    failureReason: dispatchResult.failureReason,
    reviewRequiredReason: dispatchResult.status === "review_required" ? (dispatchResult.failureReason ?? "review required") : null,
    payloadRefs: {
      ...input.state.payloadRefs,
      ...dispatchResult.payloadRefs,
    },
  });
}