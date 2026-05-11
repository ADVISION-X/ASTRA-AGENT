import { createEmergencyStopCapability } from "../children/emergency-stop/implementation.js";
import { createEvaluateStepTransitionCapability } from "../children/evaluate-step-transition/implementation.js";
import { createExecuteRuntimeStepCapability } from "../children/execute-runtime-step/implementation.js";
import { createFinalizeMissionCapability } from "../children/finalize-mission/implementation.js";
import { createPauseMissionCapability } from "../children/pause-mission/implementation.js";
import { createResumeMissionCapability } from "../children/resume-mission/implementation.js";
import type { OrchestrationExecuteInput, OrchestrationExecuteResult } from "../contract.js";
import { buildFailureExecuteResult } from "./orchestration-execute-result.js";
import { createStartMissionCapability } from "../children/start-mission/implementation.js";
import { createStopMissionCapability } from "../children/stop-mission/implementation.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";

type OrchestrationAbilityChildExecutor = {
  execute(input: unknown, context: OrchestrationRuntimeContext): Promise<OrchestrationExecuteResult>;
};

export function createOrchestrationChildren(): Record<string, OrchestrationAbilityChildExecutor> {
  return {
    "start-mission": createStartMissionCapability(),
    "pause-mission": createPauseMissionCapability(),
    "resume-mission": createResumeMissionCapability(),
    "stop-mission": createStopMissionCapability(),
    "emergency-stop": createEmergencyStopCapability(),
    "execute-runtime-step": createExecuteRuntimeStepCapability(),
    "evaluate-step-transition": createEvaluateStepTransitionCapability(),
    "finalize-mission": createFinalizeMissionCapability(),
  };
}

export async function executeOrchestrationChild(inputValue: OrchestrationExecuteInput, context: OrchestrationRuntimeContext, children: Record<string, OrchestrationAbilityChildExecutor>): Promise<OrchestrationExecuteResult> {
  const child = children[inputValue.childCapabilityId];
  if (!child) {
    const now = context.clock.now().isoTimestamp;
    return buildFailureExecuteResult({
      missionId: null,
      mapId: null,
      requestedPlatform: null,
      humanGoal: null,
      childCapabilityId: inputValue.childCapabilityId,
      caller: "orchestration",
      startedAt: now,
      endedAt: now,
      failureReason: `Unknown orchestration child capability: "${inputValue.childCapabilityId}".`,
      dataQualityFlags: ["unknown_child_capability"],
    });
  }

  return child.execute(inputValue.payload, context);
}
