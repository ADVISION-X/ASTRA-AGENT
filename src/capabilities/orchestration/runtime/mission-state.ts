import type { MissionState } from "../contract.js";
import { MissionStateSchema } from "../schema.js";

const missions = new Map<string, MissionState>();
let activeMissionId: string | null = null;

function now(): string {
  return new Date().toISOString();
}

const IDLE_STATE: MissionState = MissionStateSchema.parse({
  missionId: "none",
  runId: "none",
  status: "idle",
  updatedAt: now(),
});

export { now };

export function getMissionState(missionId?: string | null): MissionState {
  const id = missionId ?? activeMissionId;
  if (!id) return IDLE_STATE;
  return missions.get(id) ?? IDLE_STATE;
}

export function upsertMissionState(state: MissionState): void {
  missions.set(state.missionId, state);
}

export function setActiveMission(missionId: string | null): void {
  activeMissionId = missionId;
}

export function createInitialMissionState(params: {
  missionId: string;
  runId: string;
  humanGoal: string;
  requestedPlatform: string;
  selectedPlatforms: string[];
  maxRounds?: number | null;
  maxMinutes?: number | null;
  targetProfileRef?: string | null;
  targetUrl?: string | null;
  targetTitle?: string | null;
}): MissionState {
  return MissionStateSchema.parse({
    missionId: params.missionId,
    runId: params.runId,
    humanGoal: params.humanGoal,
    requestedPlatform: params.requestedPlatform,
    selectedPlatforms: params.selectedPlatforms,
    maxRounds: params.maxRounds ?? null,
    maxMinutes: params.maxMinutes ?? null,
    ...(params.targetProfileRef ? { targetProfileRef: params.targetProfileRef } : {}),
    ...(params.targetUrl ? { targetUrl: params.targetUrl } : {}),
    ...(params.targetTitle ? { targetTitle: params.targetTitle } : {}),
    status: "pending",
    roundIndex: 0,
    activeRunId: params.runId,
    startedAt: now(),
    updatedAt: now(),
  });
}

type StatusTransitionPatch = {
  status: MissionState["status"];
  reviewRequiredReason?: string | null;
  stopReason?: string | null;
  failureReason?: string | null;
  roundIndexDelta?: number;
  endedAt?: string | null;
  lastHumanCommand?: MissionState["lastHumanCommand"];
};

export function applyStatusTransition(
  current: MissionState,
  patch: StatusTransitionPatch,
): MissionState {
  const updated: MissionState = {
    ...current,
    status: patch.status,
    updatedAt: now(),
  };
  if (patch.reviewRequiredReason !== undefined) updated.reviewRequiredReason = patch.reviewRequiredReason;
  if (patch.stopReason !== undefined) updated.stopReason = patch.stopReason;
  if (patch.failureReason !== undefined) updated.failureReason = patch.failureReason;
  if (patch.roundIndexDelta !== undefined) updated.roundIndex = (current.roundIndex ?? 0) + patch.roundIndexDelta;
  if (patch.endedAt !== undefined) updated.endedAt = patch.endedAt;
  if (patch.lastHumanCommand !== undefined) updated.lastHumanCommand = patch.lastHumanCommand;
  return updated;
}
