import type { MissionCommand, OrchestrationAbilityGroup, OrchestrationExecuteInput, OrchestrationExecuteResult } from "./contract.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type {
  ForensicsPersistenceAbilityResult,
  ForensicsStructuredActionLogInput,
  ForensicsStructuredRuntimeEventInput,
} from "../forensics-persistence/contract.js";
import { listOrchestrationChildren } from "./registry.js";
import { readCurrentMissionState } from "./runtime/orchestration-ability-support.js";
import { createOrchestrationChildren, executeOrchestrationChild } from "./runtime/orchestration-child-runner.js";
import { createDefaultOrchestrationMapStore } from "./runtime/orchestration-default-map-store.js";
import { createOrchestrationRuntimeContext } from "./runtime/orchestration-runtime-context.js";

type OrchestrationForensicsSurface = {
  writeStructuredRuntimeEvent(input: ForensicsStructuredRuntimeEventInput): Promise<ForensicsPersistenceAbilityResult>;
  writeStructuredActionLog(input: ForensicsStructuredActionLogInput): Promise<ForensicsPersistenceAbilityResult>;
};

export type CreateOrchestrationAbilityGroupInput = {
  nerveBus: NerveBusAbilityGroup;
  forensics: OrchestrationForensicsSurface;
};

type OrchestrationRuntime = ReturnType<typeof createOrchestrationRuntimeContext>;
type ExecuteEnvelope = (inputValue: OrchestrationExecuteInput) => Promise<OrchestrationExecuteResult>;

function readStateSnapshot(executeEnvelope: ExecuteEnvelope, inputValue: OrchestrationExecuteInput) {
  return executeEnvelope(inputValue).then((result) => result.stateSnapshot);
}

function createCatalogMethods(context: OrchestrationRuntime): Pick<OrchestrationAbilityGroup, "listChildCapabilityIds" | "getMissionState"> {
  return {
    listChildCapabilityIds() {
      return listOrchestrationChildren();
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

function assembleOrchestrationAbilityGroup(context: OrchestrationRuntime, executeEnvelope: ExecuteEnvelope): OrchestrationAbilityGroup {
  return {
    ...createCatalogMethods(context),
    ...createExecutionMethods(executeEnvelope),
    ...createControlMethods(executeEnvelope),
  };
}

export function createOrchestrationAbilityGroup(input: CreateOrchestrationAbilityGroupInput): OrchestrationAbilityGroup {
  const context = createOrchestrationRuntimeContext({
    mapStore: createDefaultOrchestrationMapStore(),
    nerveBus: input.nerveBus,
    forensics: input.forensics,
  });
  const children = createOrchestrationChildren();
  const executeEnvelope: ExecuteEnvelope = (inputValue) => executeOrchestrationChild(inputValue, context, children);
  return assembleOrchestrationAbilityGroup(context, executeEnvelope);
}
