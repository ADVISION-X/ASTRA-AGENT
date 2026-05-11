import type { MissionState, RuntimePlan } from "../contract.js";

const PRODUCTION_MAX_HOPS = 500;

type LoopGuardStopReason =
  | "completed_by_run_limit"
  | "completed_by_time_limit"
  | "blocked_by_loop_guard";

export function evaluateLoopGuard(input: { state: MissionState; map: RuntimePlan; nowIsoTimestamp: string }) {
  if (input.state.configuredMaxRounds !== null && input.state.currentRoundIndex >= input.state.configuredMaxRounds) {
    return { loopDecision: "stop_completed" as const, nextHopCount: input.state.hopCount, reason: "completed_by_run_limit" as const };
  }

  if (input.state.configuredMaxMinutes !== null && input.state.startedAt) {
    const elapsedMs = Date.parse(input.nowIsoTimestamp) - Date.parse(input.state.startedAt);
    if (elapsedMs >= input.state.configuredMaxMinutes * 60_000) {
      return { loopDecision: "stop_completed" as const, nextHopCount: input.state.hopCount, reason: "completed_by_time_limit" as const };
    }
  }

  const nextHopCount = input.state.hopCount + 1;
  if (nextHopCount <= PRODUCTION_MAX_HOPS) {
    return { loopDecision: "continue" as const, nextHopCount, reason: null };
  }
  return {
    loopDecision: "stop_failed" as const,
    nextHopCount,
    reason: "blocked_by_loop_guard" as const,
  };
}
