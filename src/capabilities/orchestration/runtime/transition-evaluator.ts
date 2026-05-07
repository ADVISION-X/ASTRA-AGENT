import type { z } from "zod";

import type { OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import { getEffectiveOperationalTransitions } from "./route-plan-resolver.js";

export type TransitionEvaluationDecision =
  | "matched"
  | "no_valid_transition"
  | "ambiguous_transition"
  | "invalid_decision";

export type TransitionEvaluationResult =
  | { decision: "matched"; transition: OperationalMap["transitions"][number] }
  | { decision: Exclude<TransitionEvaluationDecision, "matched">; failureReason: string };

type MissionStepResultRecord = z.output<typeof MissionStepResultSchema>;

const normalizeRouteToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/gu, "");

const readRouteLabel = (result: MissionStepResultRecord): string | null => {
  const routeLabel = result.branchFieldValues.routeLabel;
  return typeof routeLabel === "string" && routeLabel.length > 0 ? routeLabel : null;
};

const transitionMatchesRouteLabel = (
  transition: OperationalMap["transitions"][number],
  routeLabel: string,
): boolean => {
  const routeToken = transition.transitionId.split(":").pop() ?? transition.transitionId;
  return normalizeRouteToken(routeLabel) === normalizeRouteToken(routeToken);
};

const findMatchingStatusTransitions = (input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResultRecord;
}): OperationalMap["transitions"] =>
  getEffectiveOperationalTransitions(input.map).filter((candidate) =>
    candidate.fromStepId === input.currentStepId
    && candidate.onStatus === input.result.status,
  );

const filterByAiRouteLabel = (input: {
  candidates: OperationalMap["transitions"];
  result: MissionStepResultRecord;
}): TransitionEvaluationResult | { decision: "candidates"; candidates: OperationalMap["transitions"] } => {
  if (input.candidates.length <= 1) {
    return { decision: "candidates", candidates: input.candidates };
  }

  const routeLabel = readRouteLabel(input.result);
  if (!routeLabel) {
    return {
      decision: "invalid_decision",
      failureReason: `Step "${input.result.stepId}" matched multiple transitions but did not provide branchFieldValues.routeLabel.`,
    };
  }

  const routeMatches = input.candidates.filter((candidate) =>
    transitionMatchesRouteLabel(candidate, routeLabel),
  );
  if (routeMatches.length === 0) {
    return {
      decision: "invalid_decision",
      failureReason: `Step "${input.result.stepId}" returned routeLabel "${routeLabel}" but no transition suffix matched it.`,
    };
  }

  return { decision: "candidates", candidates: routeMatches };
};

const buildNoValidTransitionFailure = (mapId: string, currentStepId: string, status: string): string =>
  `Map "${mapId}" has no matching transition from step "${currentStepId}" for status "${status}".`;

const buildAmbiguousTransitionFailure = (mapId: string, currentStepId: string, transitions: OperationalMap["transitions"]): string => {
  const ids = transitions.map((t) => t.transitionId).join(", ");
  return `Map "${mapId}" step "${currentStepId}" matched ${transitions.length} transitions: [${ids}]. Exactly one must match.`;
};

const selectSingleTransition = (input: {
  map: OperationalMap;
  currentStepId: string;
  candidates: OperationalMap["transitions"];
  status: string;
}): TransitionEvaluationResult => {
  if (input.candidates.length === 0) {
    return {
      decision: "no_valid_transition",
      failureReason: buildNoValidTransitionFailure(input.map.mapId, input.currentStepId, input.status),
    };
  }

  if (input.candidates.length > 1) {
    return {
      decision: "ambiguous_transition",
      failureReason: buildAmbiguousTransitionFailure(input.map.mapId, input.currentStepId, input.candidates),
    };
  }

  return { decision: "matched", transition: input.candidates[0]! };
};

export function evaluateStepTransition(input: {
  map: OperationalMap;
  currentStepId: string;
  result: MissionStepResultRecord;
}): TransitionEvaluationResult {
  const routeFiltered = filterByAiRouteLabel({
    candidates: findMatchingStatusTransitions(input),
    result: input.result,
  });
  if (routeFiltered.decision !== "candidates") {
    return routeFiltered;
  }
  return selectSingleTransition({
    map: input.map,
    currentStepId: input.currentStepId,
    candidates: routeFiltered.candidates,
    status: input.result.status,
  });
}
