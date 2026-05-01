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

function computeStateHash(state: MissionState): string {
  return `${state.missionId ?? "null"}:${state.status}:${state.sequenceNo}:${state.stateRevision}`;
}

function createMissionStateStoreHandlers(input: {
  entries: Map<string, MissionStateEntry>;
  getActiveMissionId(): string | null;
  setActiveMissionId(nextMissionId: string | null): void;
  maxMissions: number;
  ttlMs: number;
}) {
  async function getMissionState(missionId: string): Promise<MissionState | null> {
    const entry = input.entries.get(missionId);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        input.entries.delete(missionId);
      }
      return null;
    }
    return entry.state;
  }

  async function getActiveMission(): Promise<MissionState | null> {
    const activeMissionId = input.getActiveMissionId();
    if (!activeMissionId) {
      return null;
    }
    const entry = input.entries.get(activeMissionId);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        input.entries.delete(activeMissionId);
      }
      input.setActiveMissionId(null);
      return null;
    }
    return entry.state;
  }

  async function cleanupExpiredMissions(nowMs: number): Promise<number> {
    let count = 0;
    for (const [key, entry] of input.entries) {
      if (entry.expiresAt <= nowMs) {
        input.entries.delete(key);
        if (input.getActiveMissionId() === key) {
          input.setActiveMissionId(null);
        }
        count++;
      }
    }
    return count;
  }

  async function putMissionState(state: MissionState): Promise<void> {
    const parsed = MissionStateSchema.parse(state);
    if (!parsed.missionId) {
      return;
    }
    const nowMs = Date.now();
    const existing = input.entries.get(parsed.missionId);
    if (existing && existing.state.stateRevision > parsed.stateRevision) {
      return;
    }
    const stateWithHash: MissionState = {
      ...parsed,
      stateHash: computeStateHash(parsed),
    };
    if (input.entries.size >= input.maxMissions) {
      await cleanupExpiredMissions(nowMs);
      if (input.entries.size >= input.maxMissions) {
        const oldestKey = input.entries.keys().next().value;
        if (oldestKey) {
          input.entries.delete(oldestKey);
        }
      }
    }
    input.entries.set(parsed.missionId, {
      state: stateWithHash,
      storedAt: nowMs,
      expiresAt: nowMs + input.ttlMs,
    });
    if (parsed.status === "running" || parsed.status === "paused" || parsed.status === "review_required") {
      input.setActiveMissionId(parsed.missionId);
    } else if (input.getActiveMissionId() === parsed.missionId) {
      input.setActiveMissionId(null);
    }
  }

  return { getMissionState, getActiveMission, putMissionState, cleanupExpiredMissions };
}

export function createIdleMissionState(): MissionState {
  return MissionStateSchema.parse({
    status: "idle",
    payloadRefs: {},
  });
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
