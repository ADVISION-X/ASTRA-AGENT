import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { getEffectiveSteps, getEffectiveTransitions } from "./effective-route-plan.js";

type Transition = MapPackage["operationalMap"]["transitions"][number];

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
