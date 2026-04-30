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

export function createIdleMissionState(): MissionState {
  return MissionStateSchema.parse({
    status: "idle",
    payloadRefs: {},
  });
}

function computeStateHash(state: MissionState): string {
  return `${state.missionId ?? "null"}:${state.status}:${state.sequenceNo}:${state.stateRevision}`;
}

export function createInMemoryOrchestrationStatePort(
  maxMissions = DEFAULT_MAX_MISSIONS,
  ttlMs = DEFAULT_TTL_MS,
): OrchestrationStatePort {
  const entries = new Map<string, MissionStateEntry>();
  let activeMissionId: string | null = null;

  return {
    async getMissionState(missionId) {
      const entry = entries.get(missionId);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) {
          entries.delete(missionId);
        }
        return null;
      }
      return entry.state;
    },

    async getActiveMission() {
      if (!activeMissionId) {
        return null;
      }
      const entry = entries.get(activeMissionId);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) {
          entries.delete(activeMissionId);
        }
        activeMissionId = null;
        return null;
      }
      return entry.state;
    },

    async putMissionState(state) {
      const parsed = MissionStateSchema.parse(state);
      if (!parsed.missionId) {
        return;
      }
      const nowMs = Date.now();
      const existing = entries.get(parsed.missionId);
      if (existing && existing.state.stateRevision > parsed.stateRevision) {
        return;
      }
      const stateWithHash: MissionState = {
        ...parsed,
        stateHash: computeStateHash(parsed),
      };
      if (entries.size >= maxMissions) {
        await this.cleanupExpiredMissions(nowMs);
        if (entries.size >= maxMissions) {
          const oldestKey = entries.keys().next().value;
          if (oldestKey) {
            entries.delete(oldestKey);
          }
        }
      }
      entries.set(parsed.missionId, {
        state: stateWithHash,
        storedAt: nowMs,
        expiresAt: nowMs + ttlMs,
      });
      if (parsed.status === "running" || parsed.status === "paused" || parsed.status === "review_required") {
        activeMissionId = parsed.missionId;
      } else if (activeMissionId === parsed.missionId) {
        activeMissionId = null;
      }
    },

    async cleanupExpiredMissions(nowMs) {
      let count = 0;
      for (const [key, entry] of entries) {
        if (entry.expiresAt <= nowMs) {
          entries.delete(key);
          if (activeMissionId === key) {
            activeMissionId = null;
          }
          count++;
        }
      }
      return count;
    },
  };
}
