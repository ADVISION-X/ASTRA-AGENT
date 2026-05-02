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
type TransitionOperator = OperationalMap["transitions"][number]["condition"]["operator"];
type NumericConditionOperator = Extract<TransitionOperator, "greaterThan" | "lessThan" | "confidenceAbove" | "confidenceBelow">;
type DirectConditionOperator = Exclude<TransitionOperator, NumericConditionOperator>;

function resolveConditionValue(result: MissionStepResultRecord, leftRef: "status" | "decision"): string | boolean | null {
  return leftRef === "status" ? result.status : result.decision ?? null;
}

function toNumericValue(value: string | number | boolean | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isNumericOperator(operator: TransitionOperator): operator is NumericConditionOperator {
  return ["greaterThan", "lessThan", "confidenceAbove", "confidenceBelow"].includes(operator);
}

function matchesNumericCondition(input: {
  operator: OperationalMap["transitions"][number]["condition"]["operator"];
  actual: string | boolean | null;
  expected: string | number | boolean | null;
}): boolean {
  const numericActual = toNumericValue(input.actual);
  const numericExpected = toNumericValue(input.expected);
  if (numericActual === null || numericExpected === null) {
    return false;
  }

  return input.operator === "greaterThan" || input.operator === "confidenceAbove"
    ? numericActual > numericExpected
    : numericActual < numericExpected;
}

const DIRECT_CONDITION_MATCHERS: Record<DirectConditionOperator, (input: {
  actual: string | boolean | null;
  expected: string | number | boolean | null;
  result: MissionStepResultRecord;
}) => boolean> = {
  equals: ({ actual, expected }) => actual === expected,
  statusIs: ({ actual, expected }) => actual === expected,
  notEquals: ({ actual, expected }) => actual !== expected,
  exists: ({ actual }) => actual !== null,
  notExists: ({ actual }) => actual === null,
  reviewRequired: ({ result }) => result.status === "review_required",
};

function matchesDirectCondition(input: {
  operator: DirectConditionOperator;
  actual: string | boolean | null;
  expected: string | number | boolean | null;
  result: MissionStepResultRecord;
}): boolean {
  return DIRECT_CONDITION_MATCHERS[input.operator](input);
}

function matchesTransitionCondition(input: {
  condition: OperationalMap["transitions"][number]["condition"];
  result: MissionStepResultRecord;
}): boolean {
  const actual = resolveConditionValue(input.result, input.condition.leftRef);

  return isNumericOperator(input.condition.operator)
    ? matchesNumericCondition({ operator: input.condition.operator, actual, expected: input.condition.rightValue })
    : matchesDirectCondition({ operator: input.condition.operator, actual, expected: input.condition.rightValue, result: input.result });
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
    return matchesTransitionCondition({ condition: candidate.condition, result: input.result });
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
