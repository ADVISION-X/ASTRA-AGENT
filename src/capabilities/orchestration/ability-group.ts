import type { NerveBusAbilityGroup } from "../nerve-bus/index.js";
import type { MissionCommand, MissionReviewDecisionInput, OperationalMapId, OrchestrationAbilityGroup } from "./contract.js";
import { MissionStateSchema } from "./schema.js";
import { listOrchestrationChildren } from "./registry.js";
import { createStartMissionCapability } from "./children/start-mission/implementation.js";
import { createPauseMissionCapability } from "./children/pause-mission/implementation.js";
import { createResumeMissionCapability } from "./children/resume-mission/implementation.js";
import { createStopMissionCapability } from "./children/stop-mission/implementation.js";
import { createEmergencyStopCapability } from "./children/emergency-stop/implementation.js";
import { createExecuteMapStepCapability } from "./children/execute-map-step/implementation.js";
import { createEvaluateStepTransitionCapability } from "./children/evaluate-step-transition/implementation.js";
import { createRequestHumanReviewCapability } from "./children/request-human-review/implementation.js";
import { createFinalizeMissionCapability } from "./children/finalize-mission/implementation.js";
import {
  executeMissionCommand,
  pauseMissionCommand,
  resumeMissionCommand,
  stopMissionCommand,
  emergencyStopMissionCommand,
  submitMissionReviewDecision,
} from "./runtime/orchestration-executor.js";
import { createOrchestrationRuntimeContext } from "./runtime/orchestration-runtime-context.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

export function createOrchestrationAbilityGroup(input: {
  nerveBus: NerveBusAbilityGroup;
}): OrchestrationAbilityGroup {
  const context = createOrchestrationRuntimeContext(input.nerveBus);

  const children = {
    "start-mission": createStartMissionCapability(),
    "pause-mission": createPauseMissionCapability(),
    "resume-mission": createResumeMissionCapability(),
    "stop-mission": createStopMissionCapability(),
    "emergency-stop": createEmergencyStopCapability(),
    "execute-map-step": createExecuteMapStepCapability(),
    "evaluate-step-transition": createEvaluateStepTransitionCapability(),
    "request-human-review": createRequestHumanReviewCapability(),
    "finalize-mission": createFinalizeMissionCapability(),
  } as const;

  return {
    listChildCapabilityIds() {
      return listOrchestrationChildren();
    },

    listMapIds() {
      return getDefaultMapPluginRegistry().active.listActivePackages().map((mapPackage) => mapPackage.manifest.mapId) as OperationalMapId[];
    },

    async execute(inputValue) {
      const child = (children as Record<string, { execute(input: unknown, ctx: typeof context): Promise<unknown> } | undefined>)[inputValue.childCapabilityId];
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
    },

    executeMission(command: MissionCommand) {
      return executeMissionCommand({ command, caller: "commander-console", context });
    },

    async startMission(command: MissionCommand) {
      const result = await executeMissionCommand({ command, caller: "commander-console", context });
      return result.stateSnapshot;
    },

    pauseMission(missionId: string) {
      return pauseMissionCommand({ command: { missionId, reason: null, note: null }, context });
    },

    async resumeMission(missionId: string) {
      const result = await resumeMissionCommand({ command: { missionId }, caller: "commander-console", context });
      return result.stateSnapshot;
    },

    stopMission(inputValue: { missionId: string; reason?: string }) {
      return stopMissionCommand({ command: { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null }, context });
    },

    emergencyStop(inputValue: { missionId: string; reason?: string }) {
      return emergencyStopMissionCommand({ command: { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null }, context });
    },

    async getMissionState(missionId?: string | null) {
      if (missionId) {
        const state = await context.statePort.getMissionState(missionId);
        if (state) {
          return state;
        }
      }
      const active = await context.statePort.getActiveMission();
      if (active) {
        return active;
      }
      return MissionStateSchema.parse({ status: "idle", payloadRefs: {} });
    },

    async submitReviewDecision(inputValue: MissionReviewDecisionInput) {
      const result = await submitMissionReviewDecision({ command: inputValue, caller: "commander-console", context });
      if ("stateSnapshot" in result) {
        return result.stateSnapshot;
      }
      return result;
    },
  };
}
