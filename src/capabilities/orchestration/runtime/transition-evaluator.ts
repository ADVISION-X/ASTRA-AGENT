import type { MissionStepResult, OperationalMap } from "../contract.js";

function resolveConditionValue(result: MissionStepResult, source: "status" | "decision"): string | boolean | null {
  return source === "status" ? result.status : result.decision;
}

export function evaluateStepTransition(input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResult;
}) {
  const transition = input.map.transitions.find((candidate) => {
    if (candidate.fromStepId !== input.currentStepId || candidate.onStatus !== input.result.status) {
      return false;
    }
    return resolveConditionValue(input.result, candidate.condition.source) === candidate.condition.equals;
  });
  if (!transition) {
    throw new Error(`Operational map ${input.map.mapId} has no valid transition for step ${input.currentStepId}.`);
  }
  return transition;
}