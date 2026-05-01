import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

function shouldSkipStep(stepId: string | undefined, reachable: Set<string>): boolean {
  return !stepId || reachable.has(stepId);
}

function collectNextStepIds(mapPackage: MapPackage, currentStepId: string, reachable: Set<string>): string[] {
  return mapPackage.operationalMap.transitions.flatMap((transition) =>
    transition.fromStepId === currentStepId && transition.toStepId && !reachable.has(transition.toStepId)
      ? [transition.toStepId]
      : [],
  );
}

function collectReachableSteps(mapPackage: MapPackage): Set<string> {
  const reachable = new Set<string>();
  const queue = [mapPackage.operationalMap.initialStepId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || shouldSkipStep(current, reachable)) {
      continue;
    }
    reachable.add(current);
    queue.push(...collectNextStepIds(mapPackage, current, reachable));
  }

  return reachable;
}

function validateReachableSteps(mapPackage: MapPackage, reachable: Set<string>): MapPackageValidationIssue[] {
  return mapPackage.operationalMap.steps.flatMap((step) =>
    reachable.has(step.stepId)
      ? []
      : [{
        code: "transition_not_closed",
        message: `Step ${step.stepId} is unreachable from initialStepId.`,
        path: "operationalMap.steps",
        severity: "error"
      }],
  );
}

function validateBranchBacking(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const transitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  const branchIds = [...mapPackage.operationalMap.failureBranches, ...mapPackage.operationalMap.reviewBranches];
  return branchIds.flatMap((branchId) =>
    transitionIds.has(branchId)
      ? []
      : [{
        code: "transition_not_closed",
        message: `Branch ${branchId} is not backed by a transition id.`,
        path: "operationalMap.transitions",
        severity: "error"
      }],
  );
}

export function validateMapTransitionClosure(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const reachable = collectReachableSteps(mapPackage);
  return [
    ...validateReachableSteps(mapPackage, reachable),
    ...validateBranchBacking(mapPackage),
  ];
}
