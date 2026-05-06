import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

type Step = MapPackage["operationalMap"]["steps"][number];
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
    queue.push(...collectNextStepIds(mapPackage.operationalMap.transitions, currentStepId, reachable));
  }

  return reachable;
}

function validateReachableSteps(mapPackage: MapPackage, reachable: Set<string>): MapPackageValidationIssue[] {
  return mapPackage.operationalMap.steps.flatMap((step) =>
    reachable.has(step.stepId)
      ? []
      : [issue({
        message: `Step ${step.stepId} is unreachable from initialStepId.`,
        path: "operationalMap.steps",
      })],
  );
}

function validateDeclaredBranchSet(input: {
  branchId: string;
  branchSet: Set<string>;
  branchKind: "failureBranch" | "reviewBranch";
  path: string;
}): MapPackageValidationIssue[] {
  return input.branchSet.has(input.branchId)
    ? []
    : [issue({
      message: `Step ${input.branchKind} ${input.branchId} is not declared in operationalMap.${input.branchKind === "failureBranch" ? "failureBranches" : "reviewBranches"}.`,
      path: input.path,
    })];
}

function validateDeclaredBranchTransition(input: {
  branchId: string;
  transitionIds: Set<string>;
  branchKind: "failureBranch" | "reviewBranch";
  path: string;
}): MapPackageValidationIssue[] {
  return input.transitionIds.has(input.branchId)
    ? []
    : [issue({
      message: `Step ${input.branchKind} ${input.branchId} is not backed by a transition id.`,
      path: input.path,
    })];
}

function validateStepBranch(input: {
  step: Step;
  branchId: string;
  branchSet: Set<string>;
  transitionIds: Set<string>;
  branchKind: "failureBranch" | "reviewBranch";
}): MapPackageValidationIssue[] {
  const path = `operationalMap.steps.${input.step.stepId}.${input.branchKind}`;
  return [
    ...validateDeclaredBranchSet({ branchId: input.branchId, branchSet: input.branchSet, branchKind: input.branchKind, path }),
    ...validateDeclaredBranchTransition({ branchId: input.branchId, transitionIds: input.transitionIds, branchKind: input.branchKind, path }),
  ];
}

function validateStepBranchClosure(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const transitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  const failureBranches = new Set(mapPackage.operationalMap.failureBranches);
  const reviewBranches = new Set(mapPackage.operationalMap.reviewBranches);

  return mapPackage.operationalMap.steps.flatMap((step) => [
    ...validateStepBranch({
      step,
      branchId: step.failureBranch,
      branchSet: failureBranches,
      transitionIds,
      branchKind: "failureBranch",
    }),
    ...validateStepBranch({
      step,
      branchId: step.reviewBranch,
      branchSet: reviewBranches,
      transitionIds,
      branchKind: "reviewBranch",
    }),
  ]);
}

function validateBranchBacking(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const transitionIds = new Set(mapPackage.operationalMap.transitions.map((transition) => transition.transitionId));
  const declaredBranches = [
    ...mapPackage.operationalMap.failureBranches.map((branchId) => ({ branchId, path: "operationalMap.failureBranches" })),
    ...mapPackage.operationalMap.reviewBranches.map((branchId) => ({ branchId, path: "operationalMap.reviewBranches" })),
  ];

  return declaredBranches.flatMap((branch) =>
    transitionIds.has(branch.branchId)
      ? []
      : [issue({
        message: `Branch ${branch.branchId} is not backed by a transition id.`,
        path: branch.path,
      })],
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

function collectPolicyTransitions(step: Step): Array<[string, string]> {
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
  transitionById: Map<string, Transition>;
}): MapPackageValidationIssue[] {
  const transition = input.transitionById.get(input.transitionId);
  const path = `operationalMap.steps.${input.stepId}.postActionVerification.${input.fieldName}`;
  if (!transition) {
    return [issue({
      message: `Post-action verification policy ${input.fieldName} references unknown transition ${input.transitionId}.`,
      path,
    })];
  }
  if (!input.reachableVerificationSteps.has(transition.fromStepId)) {
    return [issue({
      message: `Post-action verification policy ${input.fieldName} must resolve from a reachable post-action-verification step.`,
      path,
    })];
  }
  return [];
}

function validatePostActionVerificationStep(input: {
  mapPackage: MapPackage;
  step: Step;
  transitionById: Map<string, Transition>;
}): MapPackageValidationIssue[] {
  if (!input.step.postActionVerification) {
    return [];
  }

  const reachableVerificationSteps = collectReachableVerificationSteps(input.mapPackage, input.step.stepId);
  return collectPolicyTransitions(input.step).flatMap(([fieldName, transitionId]) =>
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
  const transitionById = new Map(
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
    ...validateStepBranchClosure(mapPackage),
    ...validatePostActionVerificationPolicies(mapPackage),
  ];
}
