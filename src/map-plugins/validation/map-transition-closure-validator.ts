import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

export function validateMapTransitionClosure(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const stepIds = new Set(mapPackage.operationalMap.steps.map((step) => step.stepId));
  const reachable = new Set<string>();
  const queue = [mapPackage.operationalMap.initialStepId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) {
      continue;
    }
    reachable.add(current);
    for (const transition of mapPackage.operationalMap.transitions) {
      if (transition.fromStepId === current && transition.toStepId && !reachable.has(transition.toStepId)) {
        queue.push(transition.toStepId);
      }
    }
  }

  for (const stepId of stepIds) {
    if (!reachable.has(stepId)) {
      issues.push({
        code: "transition_not_closed",
        message: `Step ${stepId} is unreachable from initialStepId.`,
        path: "operationalMap.steps",
        severity: "error"
      });
    }
  }

  const transitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  for (const branchId of [...mapPackage.operationalMap.failureBranches, ...mapPackage.operationalMap.reviewBranches]) {
    if (!transitionIds.has(branchId)) {
      issues.push({
        code: "transition_not_closed",
        message: `Branch ${branchId} is not backed by a transition id.`,
        path: "operationalMap.transitions",
        severity: "error"
      });
    }
  }

  return issues;
}
