import type { MapPackage } from "../shared/map-package-types.js";
import { findRoutePlanById } from "../route-plans/index.js";

const getInactiveStepIds = (mapPackage: MapPackage): Set<string> => {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  return new Set(routePlan?.inactiveStepIds ?? []);
};

export const getEffectiveSteps = (mapPackage: MapPackage): MapPackage["operationalMap"]["steps"] => {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  if (!routePlan) {
    return mapPackage.operationalMap.steps;
  }

  const inactiveStepIds = getInactiveStepIds(mapPackage);
  return [
    ...mapPackage.operationalMap.steps,
    ...routePlan.steps.filter((step) => !inactiveStepIds.has(step.stepId)),
  ];
};

export const getEffectiveTransitions = (mapPackage: MapPackage): MapPackage["operationalMap"]["transitions"] => {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  if (!routePlan) {
    return mapPackage.operationalMap.transitions;
  }

  const inactiveStepIds = getInactiveStepIds(mapPackage);
  const mapTransitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  return [
    ...mapPackage.operationalMap.transitions,
    ...routePlan.transitions.filter((transition) => (
      !mapTransitionIds.has(transition.transitionId)
      && !inactiveStepIds.has(transition.fromStepId)
      && (!transition.toStepId || !inactiveStepIds.has(transition.toStepId))
    )),
  ];
};