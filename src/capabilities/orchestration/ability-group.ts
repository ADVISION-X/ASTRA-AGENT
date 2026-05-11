import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type { ScreenshotAbilityGroup } from "../screenshot/index.js";
import type { AiAbilityGroup } from "../ai/index.js";
import type { GeometryGuardAbilityGroup } from "../geometry-guard/index.js";
import type {
  OrchestrationAbilityGroup,
  MissionCommand,
  MissionControlState,
  OrchestrationExecuteInput,
  OrchestrationExecuteResult,
  OrchestrationChildCapabilityId,
} from "./contract.js";
import { listOrchestrationChildren } from "./registry.js";
import { getMissionState } from "./runtime/mission-state.js";
import {
  handleStartMission,
  handlePauseMission,
  handleResumeMission,
  handleStopMission,
  handleEmergencyStop,
  handleDispatchRegisteredAbilitySequence,
  handleFinalizeMission,
  type OrchestrationChildrenContext,
} from "./children.js";

type ForensicsSurface = OrchestrationChildrenContext["forensics"];

type OrchestrationDeps = {
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsSurface;
  screenshot: ScreenshotAbilityGroup;
  ai: AiAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
};

async function executeChild(
  childCapabilityId: OrchestrationChildCapabilityId,
  payload: unknown,
  ctx: OrchestrationChildrenContext,
): Promise<OrchestrationExecuteResult> {
  let raw: { status: "success" | "failed" | "review_required"; stateSnapshot: MissionControlState; failureReason?: string | null; reviewRequiredReason?: string | null };
  switch (childCapabilityId) {
    case "start-mission": raw = await handleStartMission(payload, ctx); break;
    case "pause-mission": raw = await handlePauseMission(payload, ctx); break;
    case "resume-mission": raw = await handleResumeMission(payload, ctx); break;
    case "stop-mission": raw = await handleStopMission(payload, ctx); break;
    case "emergency-stop": raw = await handleEmergencyStop(payload, ctx); break;
    case "dispatch-registered-ability-sequence": raw = await handleDispatchRegisteredAbilitySequence(payload, ctx); break;
    case "finalize-mission": raw = await handleFinalizeMission(payload, ctx); break;
    default: {
      const _exhaustive: never = childCapabilityId;
      void _exhaustive;
      const idle = getMissionState();
      raw = { status: "failed", stateSnapshot: idle, failureReason: "Unknown childCapabilityId", reviewRequiredReason: null };
    }
  }
  return {
    status: raw.status,
    stateSnapshot: raw.stateSnapshot,
    failureReason: raw.failureReason ?? null,
    reviewRequiredReason: raw.reviewRequiredReason ?? null,
  };
}

export function createOrchestrationAbilityGroup(deps: OrchestrationDeps): OrchestrationAbilityGroup {
  const ctx: OrchestrationChildrenContext = {
    nerveBus: deps.nerveBus,
    forensics: deps.forensics,
    screenshotAbilityGroup: deps.screenshot,
    aiAbilityGroup: deps.ai,
    geometryGuard: deps.geometryGuard,
  };

  async function execute(input: OrchestrationExecuteInput): Promise<OrchestrationExecuteResult> {
    return executeChild(input.childCapabilityId, input.payload, ctx);
  }

  async function startMission(command: MissionCommand): Promise<MissionControlState> {
    const result = await execute({ childCapabilityId: "start-mission", payload: command });
    return result.stateSnapshot;
  }

  async function executeMission(command: MissionCommand): Promise<MissionControlState> {
    return startMission(command);
  }

  async function pauseMission(missionId: string): Promise<MissionControlState> {
    const result = await execute({ childCapabilityId: "pause-mission", payload: { missionId, reason: null, note: null } });
    return result.stateSnapshot;
  }

  async function resumeMission(missionId: string): Promise<MissionControlState> {
    const result = await execute({ childCapabilityId: "resume-mission", payload: { missionId, reason: null, note: null } });
    return result.stateSnapshot;
  }

  async function stopMission(input: { missionId: string; reason?: string | null }): Promise<MissionControlState> {
    const result = await execute({ childCapabilityId: "stop-mission", payload: { missionId: input.missionId, reason: input.reason ?? null, note: null } });
    return result.stateSnapshot;
  }

  async function emergencyStop(input: { missionId: string; reason?: string | null }): Promise<MissionControlState> {
    const result = await execute({ childCapabilityId: "emergency-stop", payload: { missionId: input.missionId, reason: input.reason ?? null, note: null } });
    return result.stateSnapshot;
  }

  async function getMissionStateMethod(missionId?: string | null): Promise<MissionControlState> {
    return getMissionState(missionId);
  }

  return {
    listChildCapabilityIds(): OrchestrationChildCapabilityId[] {
      return listOrchestrationChildren();
    },
    execute,
    executeMission,
    startMission,
    pauseMission,
    resumeMission,
    stopMission,
    emergencyStop,
    getMissionState: getMissionStateMethod,
  };
}
