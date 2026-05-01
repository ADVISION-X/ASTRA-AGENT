import type { MissionCommand, MissionReviewDecisionInput, OrchestrationAbilityGroup, OrchestrationExecuteInput, OrchestrationExecuteResult } from "./contract.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/index.js";
import { listOrchestrationChildren } from "./registry.js";
import { readCurrentMissionState } from "./runtime/orchestration-ability-support.js";
import { createOrchestrationChildren, executeOrchestrationChild } from "./runtime/orchestration-child-runner.js";
import { createDefaultOrchestrationMapStore } from "./runtime/orchestration-default-map-store.js";
import { getDefaultMapPluginRegistry, listActivePackages } from "./runtime/orchestration-map-id-list.js";
import { createOrchestrationRuntimeContext } from "./runtime/orchestration-runtime-context.js";

export type CreateOrchestrationAbilityGroupInput = {
  nerveBus: NerveBusAbilityGroup;
};

type OrchestrationRuntime = ReturnType<typeof createOrchestrationRuntimeContext>;
type ExecuteEnvelope = (inputValue: OrchestrationExecuteInput) => Promise<OrchestrationExecuteResult>;

function readStateSnapshot(executeEnvelope: ExecuteEnvelope, inputValue: OrchestrationExecuteInput) {
  return executeEnvelope(inputValue).then((result) => result.stateSnapshot);
}

function buildReviewDecisionInput(inputValue: MissionReviewDecisionInput): OrchestrationExecuteInput {
  if (inputValue.decision === "resume") {
    return { childCapabilityId: "resume-mission", payload: { missionId: inputValue.missionId, reason: null, note: inputValue.note ?? null } };
  }
  if (inputValue.decision === "stop") {
    return { childCapabilityId: "stop-mission", payload: { missionId: inputValue.missionId, reason: inputValue.note ?? "review stop requested", note: inputValue.note ?? null } };
  }
  return { childCapabilityId: "request-human-review", payload: { missionId: inputValue.missionId, reason: inputValue.note ?? "review hold requested" } };
}

function createCatalogMethods(context: OrchestrationRuntime): Pick<OrchestrationAbilityGroup, "listChildCapabilityIds" | "listMapIds" | "getMissionState"> {
  return {
    listChildCapabilityIds() {
      return listOrchestrationChildren();
    },
    listMapIds() {
      const registry = getDefaultMapPluginRegistry();
      return listActivePackages(registry.active).map((mapPackage) => mapPackage.manifest.mapId);
    },
    getMissionState(missionId?: string | null) {
      return readCurrentMissionState(context, missionId);
    },
  };
}

function createExecutionMethods(executeEnvelope: ExecuteEnvelope): Pick<OrchestrationAbilityGroup, "execute" | "executeMission" | "startMission"> {
  return {
    execute(inputValue) {
      return executeEnvelope(inputValue);
    },
    executeMission(command: MissionCommand) {
      return executeEnvelope({ childCapabilityId: "start-mission", payload: command });
    },
    startMission(command: MissionCommand) {
      return readStateSnapshot(executeEnvelope, { childCapabilityId: "start-mission", payload: command });
    },
  };
}

function createControlMethods(executeEnvelope: ExecuteEnvelope): Pick<OrchestrationAbilityGroup, "pauseMission" | "resumeMission" | "stopMission" | "emergencyStop"> {
  return {
    pauseMission(missionId: string) {
      return readStateSnapshot(executeEnvelope, { childCapabilityId: "pause-mission", payload: { missionId, reason: null, note: null } });
    },
    resumeMission(missionId: string) {
      return readStateSnapshot(executeEnvelope, { childCapabilityId: "resume-mission", payload: { missionId, reason: null, note: null } });
    },
    stopMission(inputValue: { missionId: string; reason?: string }) {
      return readStateSnapshot(executeEnvelope, { childCapabilityId: "stop-mission", payload: { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null } });
    },
    emergencyStop(inputValue: { missionId: string; reason?: string }) {
      return readStateSnapshot(executeEnvelope, { childCapabilityId: "emergency-stop", payload: { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null } });
    },
  };
}

function createReviewMethods(executeEnvelope: ExecuteEnvelope): Pick<OrchestrationAbilityGroup, "submitReviewDecision"> {
  return {
    submitReviewDecision(inputValue: MissionReviewDecisionInput) {
      return readStateSnapshot(executeEnvelope, buildReviewDecisionInput(inputValue));
    },
  };
}

function assembleOrchestrationAbilityGroup(context: OrchestrationRuntime, executeEnvelope: ExecuteEnvelope): OrchestrationAbilityGroup {
  return {
    ...createCatalogMethods(context),
    ...createExecutionMethods(executeEnvelope),
    ...createControlMethods(executeEnvelope),
    ...createReviewMethods(executeEnvelope),
  };
}

export function createOrchestrationAbilityGroup(input: CreateOrchestrationAbilityGroupInput): OrchestrationAbilityGroup {
  const context = createOrchestrationRuntimeContext({ mapStore: createDefaultOrchestrationMapStore(), nerveBus: input.nerveBus });
  const children = createOrchestrationChildren();
  const executeEnvelope: ExecuteEnvelope = (inputValue) => executeOrchestrationChild(inputValue, context, children);
  return assembleOrchestrationAbilityGroup(context, executeEnvelope);
}
