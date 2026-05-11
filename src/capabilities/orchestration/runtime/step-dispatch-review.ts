import type { RuntimePlan } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import {
  type FinalizeStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export function buildFinalizeStepResult(input: {
  map: RuntimePlan;
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
