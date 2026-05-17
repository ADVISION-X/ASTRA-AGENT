import type { MissionState } from "./contract.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../forensics-persistence/contract.js";
import type { ScreenshotAbilityGroup } from "../screenshot/index.js";
import type { AiAbilityGroup } from "../ai/index.js";
import type { GeometryGuardAbilityGroup } from "../geometry-guard/index.js";
import type { OpenAbilityGroup } from "../open/index.js";
import type { MouseScrollAbilityGroup } from "../mouse-scroll/contract.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DispatchRegisteredAbilityActionInput } from "./contract.js";
import {
  getMissionState,
  upsertMissionState,
  setActiveMission,
  createInitialMissionState,
  applyMissionStatus,
  now,
} from "./runtime/mission-state.js";
import { dispatchRegisteredAbilityAction } from "./runtime/dispatch-action.js";
import { runMissionRoundLoop } from "./runtime/mission-loop-runner.js";
import {
  StartMissionChildInputSchema,
  PauseMissionChildInputSchema,
  ResumeMissionChildInputSchema,
  StopMissionChildInputSchema,
  EmergencyStopChildInputSchema,
  DispatchRegisteredAbilityActionInputSchema,
  FinalizeMissionChildInputSchema,
} from "./schema.js";

type OrchestrationForensics = ForensicsPersistenceAbilityGroup;

export type OrchestrationChildrenContext = {
  nerveBus: NerveBusAbilityGroup;
  forensics: OrchestrationForensics;
  screenshotAbilityGroup: ScreenshotAbilityGroup;
  aiAbilityGroup: AiAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
  openAbilityGroup: OpenAbilityGroup;
  mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  runtimeLogger: RuntimeLogger;
};

type ChildResult = {
  status: "success" | "failed" | "review_required";
  stateSnapshot: MissionState;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
};

export async function handleStartMission(rawInput: unknown, ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = StartMissionChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const idle = getMissionState();
    return { status: "failed", stateSnapshot: idle, failureReason: `Invalid start-mission input: ${parsed.error.message}` };
  }
  const cmd = parsed.data;
  const existing = getMissionState(cmd.missionId);
  if (existing.status === "running" || existing.status === "pending") {
    return { status: "success", stateSnapshot: existing };
  }
  const initial = createInitialMissionState({
    missionId: cmd.missionId,
    runId: cmd.runId,
    humanGoal: cmd.humanGoal,
    requestedPlatform: cmd.requestedPlatform,
    selectedPlatforms: cmd.selectedPlatforms ?? [],
    maxRounds: cmd.maxRounds ?? null,
    maxMinutes: cmd.maxMinutes ?? null,
    targetProfileRef: (cmd.initialPayload?.["targetProfileRef"] as string | null | undefined) ?? null,
    targetUrl: (cmd.initialPayload?.["targetUrl"] as string | null | undefined) ?? null,
    targetTitle: (cmd.initialPayload?.["targetTitle"] as string | null | undefined) ?? null,
  });
  const running = applyMissionStatus(initial, { status: "running", lastHumanCommand: "start-mission" });
  upsertMissionState(running);
  setActiveMission(cmd.missionId);

  ctx.runtimeLogger.emit({
    traceId: cmd.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "MISSION_STARTED",
    owner: "orchestration",
    missionId: cmd.missionId,
    runId: cmd.runId,
    status: "started",
    reason: `Mission started platform=${cmd.requestedPlatform}`,
  });

  // Fire-and-forget: start the autonomous round loop asynchronously.
  // If the loop throws unexpectedly, record the failure in mission state.
  void runMissionRoundLoop(cmd.missionId, ctx).catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    const failed = applyMissionStatus(getMissionState(cmd.missionId), { status: "failed", failureReason: errMsg });
    upsertMissionState(failed);
    setActiveMission(null);
  });

  return { status: "success", stateSnapshot: running };
}

export async function handlePauseMission(rawInput: unknown, _ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = PauseMissionChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid pause-mission input` };
  }
  const current = getMissionState(parsed.data.missionId);
  if (current.status !== "running") {
    return { status: "failed", stateSnapshot: current, failureReason: `Cannot pause: mission is ${current.status}` };
  }
  const updated = applyMissionStatus(current, { status: "paused", lastHumanCommand: "pause-mission" });
  upsertMissionState(updated);
  return { status: "success", stateSnapshot: updated };
}

export async function handleResumeMission(rawInput: unknown, _ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = ResumeMissionChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid resume-mission input` };
  }
  const current = getMissionState(parsed.data.missionId);
  if (current.status !== "paused") {
    return { status: "failed", stateSnapshot: current, failureReason: `Cannot resume: mission is ${current.status}` };
  }
  const updated = applyMissionStatus(current, { status: "running", lastHumanCommand: "resume-mission" });
  upsertMissionState(updated);
  return { status: "success", stateSnapshot: updated };
}

export async function handleStopMission(rawInput: unknown, _ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = StopMissionChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid stop-mission input` };
  }
  const { missionId, reason } = parsed.data;
  const current = getMissionState(missionId);
  const updated = applyMissionStatus(current, {
    status: "stopped",
    stopReason: reason ?? "operator stopped",
    endedAt: now(),
    lastHumanCommand: "stop-mission",
  });
  upsertMissionState(updated);
  setActiveMission(null);
  return { status: "success", stateSnapshot: updated };
}

export async function handleEmergencyStop(rawInput: unknown, _ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = EmergencyStopChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid emergency-stop input` };
  }
  const { missionId, reason } = parsed.data;
  const current = getMissionState(missionId);
  const updated = applyMissionStatus(current, {
    status: "stopped",
    stopReason: reason ?? "emergency stop",
    endedAt: now(),
    lastHumanCommand: "emergency-stop",
  });
  upsertMissionState(updated);
  setActiveMission(null);
  return { status: "success", stateSnapshot: updated };
}

export async function handleDispatchRegisteredAbilityAction(rawInput: unknown, ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = DispatchRegisteredAbilityActionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid dispatch input: ${parsed.error.message}` };
  }
  const input = parsed.data as DispatchRegisteredAbilityActionInput;
  const result = await dispatchRegisteredAbilityAction(input, {
    nerveBus: ctx.nerveBus,
    forensics: ctx.forensics,
    geometryGuard: ctx.geometryGuard,
    screenshotAbilityGroup: ctx.screenshotAbilityGroup,
    runtimeLogger: ctx.runtimeLogger,
  });
  return {
    status: result.status,
    stateSnapshot: result.stateSnapshot,
    failureReason: result.failureReason,
    reviewRequiredReason: result.reviewRequiredReason,
  };
}

export async function handleFinalizeMission(rawInput: unknown, _ctx: OrchestrationChildrenContext): Promise<ChildResult> {
  const parsed = FinalizeMissionChildInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "failed", stateSnapshot: getMissionState(), failureReason: `Invalid finalize-mission input` };
  }
  const { missionId, reason } = parsed.data;
  const current = getMissionState(missionId);
  const updated = applyMissionStatus(current, {
    status: "completed",
    stopReason: reason ?? null,
    endedAt: now(),
  });
  upsertMissionState(updated);
  setActiveMission(null);
  return { status: "success", stateSnapshot: updated };
}
