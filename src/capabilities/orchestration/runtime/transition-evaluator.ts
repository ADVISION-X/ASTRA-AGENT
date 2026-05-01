import type { z } from "zod";

import type { OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";

export type TransitionEvaluationDecision =
  | "matched"
  | "no_valid_transition"
  | "ambiguous_transition"
  | "invalid_decision";

export type TransitionEvaluationResult =
  | { decision: "matched"; transition: OperationalMap["transitions"][number] }
  | { decision: Exclude<TransitionEvaluationDecision, "matched">; failureReason: string };

type MissionStepResultRecord = z.output<typeof MissionStepResultSchema>;

function resolveConditionValue(result: MissionStepResultRecord, source: "status" | "decision"): string | boolean | null {
  return source === "status" ? result.status : result.decision ?? null;
}

function findMatchingTransitions(input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResultRecord;
}): OperationalMap["transitions"] {
  return input.map.transitions.filter((candidate) => {
    if (candidate.fromStepId !== input.currentStepId) {
      return false;
    }
    if (candidate.onStatus !== input.result.status) {
      return false;
    }
    const actual = resolveConditionValue(input.result, candidate.condition.source);
    return actual === candidate.condition.equals;
  });
}

function buildNoValidTransitionFailure(mapId: string, currentStepId: string, status: string): string {
  return `Map "${mapId}" has no matching transition from step "${currentStepId}" for status "${status}".`;
}

function buildAmbiguousTransitionFailure(mapId: string, currentStepId: string, transitions: OperationalMap["transitions"]): string {
  const ids = transitions.map((t) => t.transitionId).join(", ");
  return `Map "${mapId}" step "${currentStepId}" matched ${transitions.length} transitions: [${ids}]. Exactly one must match.`;
}

export function evaluateStepTransition(input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResultRecord;
}): TransitionEvaluationResult {
  const candidates = findMatchingTransitions(input);

  if (candidates.length === 0) {
    return {
      decision: "no_valid_transition",
      failureReason: buildNoValidTransitionFailure(input.map.mapId, input.currentStepId, input.result.status),
    };
  }

  if (candidates.length > 1) {
    return {
      decision: "ambiguous_transition",
      failureReason: buildAmbiguousTransitionFailure(input.map.mapId, input.currentStepId, candidates),
    };
  }

  return { decision: "matched", transition: candidates[0]! };
}
