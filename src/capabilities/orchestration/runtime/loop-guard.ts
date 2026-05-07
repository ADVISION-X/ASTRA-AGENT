import type { MissionState, OperationalMap } from "../contract.js";

const PRODUCTION_MAX_HOPS = 500;

export function evaluateLoopGuard(input: { state: MissionState; map: OperationalMap; nowIsoTimestamp: string }) {
  if (input.state.configuredMaxRounds !== null && input.state.currentRoundIndex >= input.state.configuredMaxRounds) {
    return { loopDecision: "stop_completed" as const, nextHopCount: input.state.hopCount };
  }

  if (input.state.configuredMaxMinutes !== null && input.state.startedAt) {
    const elapsedMs = Date.parse(input.nowIsoTimestamp) - Date.parse(input.state.startedAt);
    if (elapsedMs >= input.state.configuredMaxMinutes * 60_000) {
      return { loopDecision: "stop_completed" as const, nextHopCount: input.state.hopCount };
    }
  }

  const nextHopCount = input.state.hopCount + 1;
  if (nextHopCount <= PRODUCTION_MAX_HOPS) {
    return { loopDecision: "continue" as const, nextHopCount };
  }
  return {
    loopDecision: "stop_failed" as const,
    nextHopCount,
  };
}
