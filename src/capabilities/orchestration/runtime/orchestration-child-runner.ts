import { createEmergencyStopCapability } from "../children/emergency-stop/implementation.js";
import { createEvaluateStepTransitionCapability } from "../children/evaluate-step-transition/implementation.js";
import { createExecuteMapStepCapability } from "../children/execute-map-step/implementation.js";
import { createFinalizeMissionCapability } from "../children/finalize-mission/implementation.js";
import { createPauseMissionCapability } from "../children/pause-mission/implementation.js";
import { createRequestHumanReviewCapability } from "../children/request-human-review/implementation.js";
import { createResumeMissionCapability } from "../children/resume-mission/implementation.js";
import { MissionStateSchema } from "../schema.js";
import { createStartMissionCapability } from "../children/start-mission/implementation.js";
import { createStopMissionCapability } from "../children/stop-mission/implementation.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";

type OrchestrationAbilityChildExecutor = {
  execute(input: unknown, context: OrchestrationRuntimeContext): Promise<unknown>;
};

export function createOrchestrationChildren(): Record<string, OrchestrationAbilityChildExecutor> {
  return {
    "start-mission": createStartMissionCapability(),
    "pause-mission": createPauseMissionCapability(),
    "resume-mission": createResumeMissionCapability(),
    "stop-mission": createStopMissionCapability(),
    "emergency-stop": createEmergencyStopCapability(),
    "execute-map-step": createExecuteMapStepCapability(),
    "evaluate-step-transition": createEvaluateStepTransitionCapability(),
    "request-human-review": createRequestHumanReviewCapability(),
    "finalize-mission": createFinalizeMissionCapability(),
  };
}

export async function executeOrchestrationChild(inputValue: { childCapabilityId: string; payload: unknown }, context: OrchestrationRuntimeContext, children: Record<string, OrchestrationAbilityChildExecutor>): Promise<unknown> {
  const child = children[inputValue.childCapabilityId];
  if (!child) {
    return {
      status: "failed",
      output: null,
      stateSnapshot: MissionStateSchema.parse({ status: "failed", payloadRefs: {} }),
      failureReason: `Unknown orchestration child capability: "${inputValue.childCapabilityId}".`,
      reviewRequiredReason: null,
      runtimeProof: null,
      policyDecision: "allowed",
      dataQualityFlags: ["unknown_child_capability"],
    };
  }

  return child.execute(inputValue.payload, context);
}