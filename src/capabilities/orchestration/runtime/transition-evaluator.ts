import type { MissionStepResult, OperationalMap } from "../contract.js";

export type TransitionEvaluationDecision =
  | "matched"
  | "no_valid_transition"
  | "ambiguous_transition"
  | "invalid_decision";

export type TransitionEvaluationResult =
  | { decision: "matched"; transition: OperationalMap["transitions"][number] }
  | { decision: Exclude<TransitionEvaluationDecision, "matched">; failureReason: string };

function resolveConditionValue(result: MissionStepResult, source: "status" | "decision"): string | boolean | null {
  return source === "status" ? result.status : result.decision ?? null;
}

export function evaluateStepTransition(input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResult;
}): TransitionEvaluationResult {
  const candidates = input.map.transitions.filter((candidate) => {
    if (candidate.fromStepId !== input.currentStepId) {
      return false;
    }
    if (candidate.onStatus !== input.result.status) {
      return false;
    }
    const actual = resolveConditionValue(input.result, candidate.condition.source);
    return actual === candidate.condition.equals;
  });

  if (candidates.length === 0) {
    return {
      decision: "no_valid_transition",
      failureReason: `Map "${input.map.mapId}" has no matching transition from step "${input.currentStepId}" for status "${input.result.status}".`,
    };
  }

  if (candidates.length > 1) {
    const ids = candidates.map((t) => t.transitionId).join(", ");
    return {
      decision: "ambiguous_transition",
      failureReason: `Map "${input.map.mapId}" step "${input.currentStepId}" matched ${candidates.length} transitions: [${ids}]. Exactly one must match.`,
    };
  }

  return { decision: "matched", transition: candidates[0]! };
}
