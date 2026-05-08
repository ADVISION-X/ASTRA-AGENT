import type { OperationalMap } from "../contract.js";
import { findRoutePlanById } from "../../../map-plugins/route-plans/index.js";

type OperationalStep = OperationalMap["steps"][number];
type OperationalTransition = OperationalMap["transitions"][number];

const getRoutePlan = (map: OperationalMap) => findRoutePlanById(map.routePlanId);

export const getEffectiveOperationalSteps = (map: OperationalMap): OperationalStep[] => {
  const routePlan = getRoutePlan(map);
  return routePlan ? [...map.steps, ...routePlan.steps] : map.steps;
};

export const getEffectiveOperationalTransitions = (map: OperationalMap): OperationalTransition[] => {
  const routePlan = getRoutePlan(map);
  if (!routePlan) {
    return map.transitions;
  }

  const mapTransitionIds = new Set(map.transitions.map((transition) => transition.transitionId));
  return [
    ...map.transitions,
    ...routePlan.transitions.filter((transition) => !mapTransitionIds.has(transition.transitionId)),
  ];
};

export const findEffectiveOperationalStep = (map: OperationalMap, stepId: string): OperationalStep | null =>
  getEffectiveOperationalSteps(map).find((candidate) => candidate.stepId === stepId) ?? null;
