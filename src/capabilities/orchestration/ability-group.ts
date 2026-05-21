import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type { ScreenshotAbilityGroup } from "../screenshot/index.js";
import type { AiAbilityGroup } from "../ai/index.js";
import type { GeometryGuardAbilityGroup } from "../geometry-guard/index.js";
import type { OpenAbilityGroup } from "../open/index.js";
import type { MouseScrollAbilityGroup } from "../mouse-scroll/contract.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
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
import type { OrchestrationChildrenContext } from "./children-context.js";
import {
  handleStartMission,
  handlePauseMission,
  handleResumeMission,
  handleStopMission,
  handleEmergencyStop,
  handleDispatchRegisteredAbilityAction,
  handleFinalizeMission,
} from "./children.js";

type ForensicsSurface = OrchestrationChildrenContext["forensics"];

type OrchestrationDeps = {
  dataDir: string;
  browserController: OrchestrationChildrenContext["browserController"];
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsSurface;
  screenshot: ScreenshotAbilityGroup;
  ai: AiAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
  open: OpenAbilityGroup;
  mouseScroll: MouseScrollAbilityGroup;
  runtimeLogger: RuntimeLogger;
};

type MissionStopInput = { missionId: string; reason?: string | null };

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
    case "dispatch-registered-ability-action": raw = await handleDispatchRegisteredAbilityAction(payload, ctx); break;
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

const buildChildrenContext = (
  deps: OrchestrationDeps,
): OrchestrationChildrenContext => ({
  dataDir: deps.dataDir,
  browserController: deps.browserController,
  nerveBus: deps.nerveBus,
  forensics: deps.forensics,
  screenshotAbilityGroup: deps.screenshot,
  aiAbilityGroup: deps.ai,
  geometryGuard: deps.geometryGuard,
  openAbilityGroup: deps.open,
  mouseScrollAbilityGroup: deps.mouseScroll,
  runtimeLogger: deps.runtimeLogger,
});

const executeMissionStateCommand = async (
  ctx: OrchestrationChildrenContext,
  childCapabilityId: OrchestrationChildCapabilityId,
  payload: unknown,
): Promise<MissionControlState> => {
  const result = await executeChild(childCapabilityId, payload, ctx);
  return result.stateSnapshot;
};

const buildNeutralMissionPayload = (missionId: string) => ({
  missionId,
  reason: null,
  note: null,
});

const buildReasonedMissionPayload = (input: MissionStopInput) => ({
  missionId: input.missionId,
  reason: input.reason ?? null,
  note: null,
});

export function createOrchestrationAbilityGroup(deps: OrchestrationDeps): OrchestrationAbilityGroup {
  const ctx = buildChildrenContext(deps);

  return {
    listChildCapabilityIds: listOrchestrationChildren,
    execute: (input: OrchestrationExecuteInput): Promise<OrchestrationExecuteResult> =>
      executeChild(input.childCapabilityId, input.payload, ctx),
    executeMission: (command: MissionCommand): Promise<MissionControlState> =>
      executeMissionStateCommand(ctx, "start-mission", command),
    startMission: (command: MissionCommand): Promise<MissionControlState> =>
      executeMissionStateCommand(ctx, "start-mission", command),
    pauseMission: (missionId: string): Promise<MissionControlState> =>
      executeMissionStateCommand(
        ctx,
        "pause-mission",
        buildNeutralMissionPayload(missionId),
      ),
    resumeMission: (missionId: string): Promise<MissionControlState> =>
      executeMissionStateCommand(
        ctx,
        "resume-mission",
        buildNeutralMissionPayload(missionId),
      ),
    stopMission: (input: MissionStopInput): Promise<MissionControlState> =>
      executeMissionStateCommand(
        ctx,
        "stop-mission",
        buildReasonedMissionPayload(input),
      ),
    emergencyStop: (input: MissionStopInput): Promise<MissionControlState> =>
      executeMissionStateCommand(
        ctx,
        "emergency-stop",
        buildReasonedMissionPayload(input),
      ),
    getMissionState: (missionId?: string | null): Promise<MissionControlState> =>
      Promise.resolve(getMissionState(missionId)),
  };
}
