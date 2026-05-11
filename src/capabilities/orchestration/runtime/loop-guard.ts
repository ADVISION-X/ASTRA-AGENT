import type { MissionState } from "../contract.js";

export type LoopGuardResult =
  | { shouldStop: false }
  | { shouldStop: true; reason: "max-rounds-reached" | "max-minutes-reached" | "mission-not-running" };

const MAX_ROUNDS_DEFAULT = 20;

function elapsedMinutes(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  return (Date.now() - new Date(startedAt).getTime()) / 60_000;
}

export function checkLoopGuardBeforeRound(state: MissionState): LoopGuardResult {
  if (state.status !== "running") {
    return { shouldStop: true, reason: "mission-not-running" };
  }
  const maxRounds = state.maxRounds ?? MAX_ROUNDS_DEFAULT;
  if ((state.roundIndex ?? 0) >= maxRounds) {
    return { shouldStop: true, reason: "max-rounds-reached" };
  }
  if (state.maxMinutes != null) {
    const elapsed = elapsedMinutes(state.startedAt);
    if (elapsed >= state.maxMinutes) {
      return { shouldStop: true, reason: "max-minutes-reached" };
    }
  }
  return { shouldStop: false };
}

export function checkLoopGuardAfterRound(state: MissionState): LoopGuardResult {
  if (
    state.status === "stopped" ||
    state.status === "failed" ||
    state.status === "completed" ||
    state.status === "paused"
  ) {
    return { shouldStop: true, reason: "mission-not-running" };
  }
  return checkLoopGuardBeforeRound(state);
}
