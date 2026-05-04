import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  applyStepOutputRefPolicy,
  buildBranchFieldValues,
  type AiStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export function buildAiStepResult(input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
  missionId: string;
  dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendRequestToAi"]>>;
}): StepDispatchResult {
  const outputRef = input.dispatchResult.payloadRefs.aiResultRef ?? null;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: input.dispatchResult.status,
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: input.dispatchResult.envelopeId,
      resultRef: input.dispatchResult.resultRef,
      outputRef,
      decision: input.dispatchResult.decision,
      branchFieldValues: buildBranchFieldValues({ decision: input.dispatchResult.decision, branchFieldValues: input.dispatchResult.branchFieldValues }),
      failureReason: input.dispatchResult.failureReason,
      reviewRequiredReason: input.dispatchResult.status === "review_required" ? (input.dispatchResult.failureReason ?? "review required") : null,
      payloadRefs: applyStepOutputRefPolicy(input.step, { ...input.state.payloadRefs, ...input.dispatchResult.payloadRefs }, outputRef),
    }),
  };
}