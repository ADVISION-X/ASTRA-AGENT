import type { MissionState, OperationalMap } from "../contract.js";

export function evaluateLoopGuard(input: { state: MissionState; map: OperationalMap }) {
  const nextHopCount = input.state.hopCount + 1;
  if (nextHopCount <= input.map.sequencePolicy.maxHops) {
    return { loopDecision: "continue" as const, nextHopCount };
  }
  return {
    loopDecision: input.map.sequencePolicy.loopDecisionOnLimit === "failed"
      ? "stop_failed" as const
      : "stop_review_required" as const,
    nextHopCount,
  };
}