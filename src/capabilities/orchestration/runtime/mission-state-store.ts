import type { MissionState } from "../contract.js";
import { MissionStateSchema } from "../schema.js";
import type { OrchestrationStatePort } from "../ports/orchestration-state-port.js";

const DEFAULT_MAX_MISSIONS = 100;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type MissionStateEntry = {
  state: MissionState;
  storedAt: number;
  expiresAt: number;
};

type MissionStateStoreContext = {
  entries: Map<string, MissionStateEntry>;
  getActiveMissionId(): string | null;
  setActiveMissionId(nextMissionId: string | null): void;
  maxMissions: number;
  ttlMs: number;
};

function computeStateHash(state: MissionState): string {
  return `${state.missionId ?? "null"}:${state.status}:${state.sequenceNo}:${state.stateRevision}`;
}

function isMissionStateExpired(entry: MissionStateEntry, nowMs: number): boolean {
  return entry.expiresAt <= nowMs;
}

async function getMissionStateFromStore(context: MissionStateStoreContext, missionId: string): Promise<MissionState | null> {
  const entry = context.entries.get(missionId);
  if (!entry || isMissionStateExpired(entry, Date.now())) {
    if (entry) {
      context.entries.delete(missionId);
    }
    return null;
  }

  return entry.state;
}

async function getActiveMissionFromStore(context: MissionStateStoreContext): Promise<MissionState | null> {
  const activeMissionId = context.getActiveMissionId();
  if (!activeMissionId) {
    return null;
  }

  const entry = context.entries.get(activeMissionId);
  if (!entry || isMissionStateExpired(entry, Date.now())) {
    if (entry) {
      context.entries.delete(activeMissionId);
    }
    context.setActiveMissionId(null);
    return null;
  }

  return entry.state;
}

async function cleanupExpiredMissionsFromStore(context: MissionStateStoreContext, nowMs: number): Promise<number> {
  let count = 0;
  for (const [key, entry] of context.entries) {
    if (isMissionStateExpired(entry, nowMs)) {
      context.entries.delete(key);
      if (context.getActiveMissionId() === key) {
        context.setActiveMissionId(null);
      }
      count++;
    }
  }

  return count;
}

function updateActiveMissionFromState(context: MissionStateStoreContext, state: MissionState): void {
  if (state.status === "running" || state.status === "paused" || state.status === "review_required") {
    context.setActiveMissionId(state.missionId);
    return;
  }

  if (context.getActiveMissionId() === state.missionId) {
    context.setActiveMissionId(null);
  }
}

async function trimMissionStoreIfNeeded(context: MissionStateStoreContext, nowMs: number): Promise<void> {
  if (context.entries.size < context.maxMissions) {
    return;
  }

  await cleanupExpiredMissionsFromStore(context, nowMs);
  if (context.entries.size < context.maxMissions) {
    return;
  }

  const oldestKey = context.entries.keys().next().value;
  if (oldestKey) {
    context.entries.delete(oldestKey);
  }
}

async function putMissionStateInStore(context: MissionStateStoreContext, state: MissionState): Promise<void> {
  const parsed = MissionStateSchema.parse(state);
  if (!parsed.missionId) {
    return;
  }

  const nowMs = Date.now();
  const existing = context.entries.get(parsed.missionId);
  if (existing && existing.state.stateRevision > parsed.stateRevision) {
    return;
  }

  await trimMissionStoreIfNeeded(context, nowMs);
  const stateWithHash: MissionState = {
    ...parsed,
    stateHash: computeStateHash(parsed),
  };
  context.entries.set(parsed.missionId, {
    state: stateWithHash,
    storedAt: nowMs,
    expiresAt: nowMs + context.ttlMs,
  });
  updateActiveMissionFromState(context, parsed);
}

function createMissionStateStoreHandlers(input: MissionStateStoreContext) {
  return {
    getMissionState: (missionId: string) => getMissionStateFromStore(input, missionId),
    getActiveMission: () => getActiveMissionFromStore(input),
    putMissionState: (state: MissionState) => putMissionStateInStore(input, state),
    cleanupExpiredMissions: (nowMs: number) => cleanupExpiredMissionsFromStore(input, nowMs),
  };
}

export function createInMemoryOrchestrationStatePort(
  maxMissions = DEFAULT_MAX_MISSIONS,
  ttlMs = DEFAULT_TTL_MS,
): OrchestrationStatePort {
  const entries = new Map<string, MissionStateEntry>();
  let activeMissionId: string | null = null;
  const handlers = createMissionStateStoreHandlers({
    entries,
    getActiveMissionId: () => activeMissionId,
    setActiveMissionId: (nextMissionId) => {
      activeMissionId = nextMissionId;
    },
    maxMissions,
    ttlMs,
  });

  return {
    getMissionState: handlers.getMissionState,
    getActiveMission: handlers.getActiveMission,
    putMissionState: handlers.putMissionState,
    cleanupExpiredMissions: handlers.cleanupExpiredMissions,
  };
}
