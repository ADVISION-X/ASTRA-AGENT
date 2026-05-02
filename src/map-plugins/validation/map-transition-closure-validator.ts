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

function buildAdjacency(mapPackage: MapPackage): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const step of mapPackage.operationalMap.steps) {
    adjacency.set(step.stepId, []);
  }
  for (const transition of mapPackage.operationalMap.transitions) {
    if (transition.toStepId) {
      adjacency.get(transition.fromStepId)?.push(transition.toStepId);
    }
  }
  return adjacency;
}

function collectReachableVerificationSteps(mapPackage: MapPackage, fromStepId: string): Set<string> {
  const adjacency = buildAdjacency(mapPackage);
  const stepById = new Map(mapPackage.operationalMap.steps.map((step) => [step.stepId, step]));
  const queue = [...(adjacency.get(fromStepId) ?? [])];
  const reachable = new Set<string>();
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentStepId = queue.shift();
    if (!currentStepId || visited.has(currentStepId)) {
      continue;
    }
    visited.add(currentStepId);

    const currentStep = stepById.get(currentStepId);
    if (currentStep?.targetAbilityGroupId === "post-action-verification") {
      reachable.add(currentStepId);
    }

    queue.push(...(adjacency.get(currentStepId) ?? []));
  }

  return reachable;
}

type PostActionVerificationStep = MapPackage["operationalMap"]["steps"][number];
type TransitionById = Map<string, MapPackage["operationalMap"]["transitions"][number]>;

function getPolicyTransitions(step: PostActionVerificationStep): Array<[string, string]> {
  const policy = step.postActionVerification;
  return policy === null
    ? []
    : [
      ["onPassTransitionId", policy.onPassTransitionId],
      ["onFailTransitionId", policy.onFailTransitionId],
      ["onAmbiguousTransitionId", policy.onAmbiguousTransitionId],
    ];
}

function validatePolicyTransition(input: {
  stepId: string;
  fieldName: string;
  transitionId: string;
  reachableVerificationSteps: Set<string>;
  transitionById: TransitionById;
}): MapPackageValidationIssue[] {
  const transition = input.transitionById.get(input.transitionId);
  if (!transition) {
    return [{
      code: "transition_not_closed",
      message: `Post-action verification policy ${input.fieldName} references unknown transition ${input.transitionId}.`,
      path: `operationalMap.steps.${input.stepId}.postActionVerification.${input.fieldName}`,
      severity: "error",
    }];
  }
  if (!input.reachableVerificationSteps.has(transition.fromStepId)) {
    return [{
      code: "transition_not_closed",
      message: `Post-action verification policy ${input.fieldName} must resolve from a reachable post-action-verification step.`,
      path: `operationalMap.steps.${input.stepId}.postActionVerification.${input.fieldName}`,
      severity: "error",
    }];
  }
  return [];
}

function validatePostActionVerificationStep(input: {
  mapPackage: MapPackage;
  step: PostActionVerificationStep;
  transitionById: TransitionById;
}): MapPackageValidationIssue[] {
  if (!input.step.postActionVerification) {
    return [];
  }

  const reachableVerificationSteps = collectReachableVerificationSteps(input.mapPackage, input.step.stepId);
  return getPolicyTransitions(input.step).flatMap(([fieldName, transitionId]) =>
    validatePolicyTransition({
      stepId: input.step.stepId,
      fieldName,
      transitionId,
      reachableVerificationSteps,
      transitionById: input.transitionById,
    }),
  );
}

function validatePostActionVerificationPolicies(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const transitionById: TransitionById = new Map(
    mapPackage.operationalMap.transitions.map((transition) => [transition.transitionId, transition]),
  );

  return mapPackage.operationalMap.steps.flatMap((step) =>
    validatePostActionVerificationStep({ mapPackage, step, transitionById }),
  );
}

export function validateMapTransitionClosure(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const reachable = collectReachableSteps(mapPackage);
  return [
    ...validateReachableSteps(mapPackage, reachable),
    ...validateBranchBacking(mapPackage),
    ...validatePostActionVerificationPolicies(mapPackage),
  ];
}
