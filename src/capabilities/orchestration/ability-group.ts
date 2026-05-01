import type { MissionCommand, MissionReviewDecisionInput, OrchestrationAbilityGroup } from "./contract.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/index.js";
import { listOrchestrationChildren } from "./registry.js";
import { readCurrentMissionState } from "./runtime/orchestration-ability-support.js";
import {
  executeMissionCommand,
  pauseMissionCommand,
  resumeMissionCommand,
  stopMissionCommand,
  emergencyStopMissionCommand,
  submitMissionReviewDecision,
} from "./runtime/orchestration-executor.js";
import { createOrchestrationChildren, executeOrchestrationChild } from "./runtime/orchestration-child-runner.js";
import { createDefaultOrchestrationMapStore } from "./runtime/orchestration-default-map-store.js";
import { getDefaultMapPluginRegistry, listActivePackages } from "./runtime/orchestration-map-id-list.js";
import { createOrchestrationRuntimeContext } from "./runtime/orchestration-runtime-context.js";

export type CreateOrchestrationAbilityGroupInput = {
  nerveBus: NerveBusAbilityGroup;
};

function createMissionEntryMethods(context: ReturnType<typeof createOrchestrationRuntimeContext>) {
  return {
    executeMission(command: MissionCommand) {
      return executeMissionCommand({ command, caller: "commander-console", context });
    },

    async startMission(command: MissionCommand) {
      const result = await executeMissionCommand({ command, caller: "commander-console", context });
      return result.stateSnapshot;
    },
  };
}

function createMissionTransitionMethods(context: ReturnType<typeof createOrchestrationRuntimeContext>) {
  return {
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
  };
}

function createMissionStateMethods(context: ReturnType<typeof createOrchestrationRuntimeContext>) {
  return {
    getMissionState(missionId?: string | null) {
      return readCurrentMissionState(context, missionId);
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

export function createOrchestrationAbilityGroup(input: CreateOrchestrationAbilityGroupInput): OrchestrationAbilityGroup {
  const context = createOrchestrationRuntimeContext({
    mapStore: createDefaultOrchestrationMapStore(),
    nerveBus: input.nerveBus,
  });
  const children = createOrchestrationChildren();
  const missionEntry = createMissionEntryMethods(context);
  const missionTransitions = createMissionTransitionMethods(context);
  const missionState = createMissionStateMethods(context);

  return {
    listChildCapabilityIds() {
      return listOrchestrationChildren();
    },

    listMapIds() {
      const registry = getDefaultMapPluginRegistry();
      return listActivePackages(registry.active).map((mapPackage) => mapPackage.manifest.mapId);
    },

    async execute(inputValue) {
      return executeOrchestrationChild(inputValue, context, children);
    },
    ...missionEntry,
    ...missionTransitions,
    ...missionState,
  };
}
