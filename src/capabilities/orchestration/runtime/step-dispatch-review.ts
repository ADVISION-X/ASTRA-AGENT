import type { OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  applyStepOutputRefPolicy,
  type FinalizeStep,
  type ReviewStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export function buildReviewStepResult(input: {
  map: OperationalMap;
  missionId: string;
  step: ReviewStep;
  reason: string | undefined;
  reviewResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendReviewRequestToCommander"]>>;
}): StepDispatchResult {
  const outputRef = input.reviewResult.payloadRefs.reviewReasonRef ?? null;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: "review_required",
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: input.reviewResult.reviewDispatchRef,
      resultRef: input.reviewResult.reviewDispatchRef,
      outputRef,
      decision: null,
      failureReason: input.reviewResult.failureReason,
      reviewRequiredReason: input.reason ?? input.reviewResult.failureReason,
      payloadRefs: applyStepOutputRefPolicy(input.step, input.reviewResult.payloadRefs, outputRef),
    }),
  };
}

export function buildFinalizeStepResult(input: {
  map: OperationalMap;
  missionId: string;
  step: FinalizeStep;
}): StepDispatchResult {
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: "success",
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      payloadRefs: {},
    }),
  };
}