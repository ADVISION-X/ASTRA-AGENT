import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { findRoutePlanById } from "../route-plans/index.js";

type Transition = MapPackage["operationalMap"]["transitions"][number];

const getEffectiveSteps = (mapPackage: MapPackage): MapPackage["operationalMap"]["steps"] => {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  return routePlan ? [...mapPackage.operationalMap.steps, ...routePlan.steps] : mapPackage.operationalMap.steps;
};

const getEffectiveTransitions = (mapPackage: MapPackage): MapPackage["operationalMap"]["transitions"] => {
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  if (!routePlan) {
    return mapPackage.operationalMap.transitions;
  }

  const mapTransitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  return [
    ...mapPackage.operationalMap.transitions,
    ...routePlan.transitions.filter((transition) => !mapTransitionIds.has(transition.transitionId)),
  ];
};

const issue = (input: { message: string; path: string }): MapPackageValidationIssue => ({
  code: "transition_not_closed",
  message: input.message,
  path: input.path,
  severity: "error",
});

function collectNextStepIds(transitions: readonly Transition[], currentStepId: string, reachable: Set<string>): string[] {
  return transitions.flatMap((transition) =>
    transition.fromStepId === currentStepId && transition.toStepId && !reachable.has(transition.toStepId)
      ? [transition.toStepId]
      : [],
  );
}

function collectReachableSteps(mapPackage: MapPackage): Set<string> {
  const reachable = new Set<string>();
  const queue = [mapPackage.operationalMap.initialStepId];

  while (queue.length > 0) {
    const currentStepId = queue.shift();
    if (!currentStepId || reachable.has(currentStepId)) {
      continue;
    }

    reachable.add(currentStepId);
    queue.push(...collectNextStepIds(getEffectiveTransitions(mapPackage), currentStepId, reachable));
  }

  return reachable;
}

function validateReachableSteps(mapPackage: MapPackage, reachable: Set<string>): MapPackageValidationIssue[] {
  return getEffectiveSteps(mapPackage).flatMap((step) =>
    reachable.has(step.stepId)
      ? []
      : [issue({
        message: `Step ${step.stepId} is unreachable from initialStepId.`,
        path: "operationalMap.steps",
      })],
  );
}

export function validateMapTransitionClosure(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const reachable = collectReachableSteps(mapPackage);
  return [
    ...validateReachableSteps(mapPackage, reachable),
  ];
}
