import { z } from "zod";

type StepValue = {
  stepId: string;
  targetAbilityGroupId?: string | null;
};

type TransitionValue = {
  transitionId: string;
  fromStepId: string;
  toStepId?: string | null;
  finalStatus?: string | null;
};

type OperationalMapValue = {
  allowedAbilityGroups: readonly string[];
  initialStepId: string;
  steps: StepValue[];
  transitions: TransitionValue[];
  failureBranches: string[];
  reviewBranches: string[];
  finalStates: string[];
};

const addIssue = (context: z.RefinementCtx, path: string, message: string): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
};

const collectStepIds = (value: OperationalMapValue, context: z.RefinementCtx): Set<string> => {
  const stepIds = new Set<string>();
  for (const step of value.steps) {
    if (stepIds.has(step.stepId)) {
      addIssue(context, "steps", "Operational map stepId must be unique.");
    }
    stepIds.add(step.stepId);
    if (step.targetAbilityGroupId && !value.allowedAbilityGroups.includes(step.targetAbilityGroupId)) {
      addIssue(context, "steps", "Step targetAbilityGroupId must be in allowedAbilityGroups.");
    }
  }
  return stepIds;
};

const validateInitialStepId = (initialStepId: string, stepIds: Set<string>, context: z.RefinementCtx): void => {
  if (!stepIds.has(initialStepId)) {
    addIssue(context, "initialStepId", "Operational map must reference an existing initialStepId.");
  }
};

const collectTransitionIds = (transitions: TransitionValue[], stepIds: Set<string>, context: z.RefinementCtx): Set<string> => {
  const transitionIds = new Set<string>();
  for (const transition of transitions) {
    if (transitionIds.has(transition.transitionId)) {
      addIssue(context, "transitions", "Transition ids must be unique.");
    }
    transitionIds.add(transition.transitionId);
    if (!stepIds.has(transition.fromStepId)) {
      addIssue(context, "transitions", "Transition fromStepId must exist.");
    }
    if (transition.toStepId && !stepIds.has(transition.toStepId)) {
      addIssue(context, "transitions", "Transition toStepId must exist.");
    }
  }
  return transitionIds;
};

const validateTransitionReferences = (
  branchIds: string[],
  transitionIds: Set<string>,
  branch: {
    path: "failureBranches" | "reviewBranches";
    label: "failureBranch" | "reviewBranch";
  },
  context: z.RefinementCtx,
): void => {
  for (const transitionId of branchIds) {
    if (!transitionIds.has(transitionId)) {
      addIssue(context, branch.path, `${branch.label} ${transitionId} must reference an existing transitionId.`);
    }
  }
};

const hasReachableFinalState = (transitions: TransitionValue[], finalState: string): boolean =>
  transitions.some((transition) => transition.finalStatus === finalState);

const validateFinalStates = (finalStates: string[], transitions: TransitionValue[], context: z.RefinementCtx): void => {
  for (const finalState of finalStates) {
    if (!hasReachableFinalState(transitions, finalState)) {
      addIssue(context, "finalStates", `finalState ${finalState} must be reachable via at least one transition.`);
    }
  }
};

export const validateMapPluginOperationalMap = (value: OperationalMapValue, context: z.RefinementCtx): void => {
  const stepIds = collectStepIds(value, context);
  validateInitialStepId(value.initialStepId, stepIds, context);

  const transitionIds = collectTransitionIds(value.transitions, stepIds, context);
  validateTransitionReferences(value.failureBranches, transitionIds, { path: "failureBranches", label: "failureBranch" }, context);
  validateTransitionReferences(value.reviewBranches, transitionIds, { path: "reviewBranches", label: "reviewBranch" }, context);
  validateFinalStates(value.finalStates, value.transitions, context);
};