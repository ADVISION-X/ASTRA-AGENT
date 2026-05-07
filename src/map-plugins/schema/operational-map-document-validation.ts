import { z } from "zod";
import { findRoutePlanById } from "../route-plans/index.js";
import { STARTUP_PREPARATION_ROUTE_LABELS } from "../shared/startup-preparation.constants.js";

type StepValue = {
  stepId: string;
  targetAbilityGroupId?: string | null;
  promptContractId?: string | null;
};

type TransitionValue = {
  transitionId: string;
  fromStepId: string;
  onStatus: string;
  toStepId?: string | null;
  finalStatus?: string | null;
};

type OperationalMapValue = {
  mapKind: "routePlanBoundMap" | "genericDiagnosticMap";
  routePlanId?: string | null;
  initialStepId: string;
  steps: StepValue[];
  transitions: TransitionValue[];
  finalStates: string[];
};

const addIssue = (context: z.RefinementCtx, path: string, message: string): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
};

const STARTUP_PREPARATION_PROMPT_CONTRACT_ID = "vision.pagePreparation.v1";

const isStartupPreparationTransitionId = (transitionId: string): boolean =>
  STARTUP_PREPARATION_ROUTE_LABELS.some((routeLabel) => transitionId.endsWith(`:${routeLabel}`));

const collectStartupPreparationStepIds = (value: OperationalMapValue): string[] =>
  value.steps
    .filter((step) => step.targetAbilityGroupId === "ai" && step.promptContractId === STARTUP_PREPARATION_PROMPT_CONTRACT_ID)
    .map((step) => step.stepId);

const collectStepIds = (value: OperationalMapValue, context: z.RefinementCtx): Set<string> => {
  const stepIds = new Set<string>();
  for (const step of value.steps) {
    if (stepIds.has(step.stepId)) {
      addIssue(context, "steps", "Operational map stepId must be unique.");
    }
    stepIds.add(step.stepId);
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

const hasReachableFinalState = (transitions: TransitionValue[], finalState: string): boolean =>
  transitions.some((transition) => transition.finalStatus === finalState);

const validateFinalStates = (finalStates: string[], transitions: TransitionValue[], context: z.RefinementCtx): void => {
  for (const finalState of finalStates) {
    if (!hasReachableFinalState(transitions, finalState)) {
      addIssue(context, "finalStates", `finalState ${finalState} must be reachable via at least one transition.`);
    }
  }
};

const validateRoutePlanBoundMap = (
  value: OperationalMapValue,
  routePlan: NonNullable<ReturnType<typeof findRoutePlanById>>,
  context: z.RefinementCtx,
): void => {
  const startupPreparationStepIds = collectStartupPreparationStepIds(value);
  if (startupPreparationStepIds.length > 1) {
    addIssue(context, "steps", "routePlanBoundMap may declare at most one startup preparation AI step.");
  }

  const mapStepIds = new Set(value.steps.map((step) => step.stepId));
  const routePlanStepIds = new Set(routePlan.steps.map((step) => step.stepId));
  const duplicatedStepIds = [...routePlanStepIds].filter((stepId) => mapStepIds.has(stepId));
  if (duplicatedStepIds.length > 0) {
    addIssue(context, "steps", `routePlanBoundMap must not duplicate Route Plan-owned steps: ${duplicatedStepIds.join(", ")}.`);
  }

  const routePlanTransitionIds = new Set(routePlan.transitions.map((transition) => transition.transitionId));
  const duplicatedTransitionIds = value.transitions
    .filter((transition) => routePlanTransitionIds.has(transition.transitionId))
    .map((transition) => transition.transitionId);
  if (duplicatedTransitionIds.length > 0) {
    addIssue(context, "transitions", `routePlanBoundMap must not duplicate Route Plan-owned transitions: ${duplicatedTransitionIds.join(", ")}.`);
  }

  const routeLabels = new Set(routePlan.outcomeOptions.map((option) => option.routeLabel));
  const localRouteLabelTransitions = value.transitions
    .filter((transition) => [...routeLabels].some((routeLabel) => transition.transitionId.endsWith(`:${routeLabel}`)))
    .map((transition) => transition.transitionId);
  if (localRouteLabelTransitions.length > 0) {
    addIssue(context, "transitions", `routePlanBoundMap must not declare routeLabel action-chain transitions: ${localRouteLabelTransitions.join(", ")}.`);
  }

  const aiStepIds = value.steps
    .filter((step) => step.targetAbilityGroupId === "ai")
    .map((step) => step.stepId);
  const localAiSuccessTransitions = value.transitions
    .filter((transition) => {
      if (!aiStepIds.includes(transition.fromStepId) || transition.onStatus !== "success") {
        return false;
      }
      return !startupPreparationStepIds.includes(transition.fromStepId) || !isStartupPreparationTransitionId(transition.transitionId);
    })
    .map((transition) => transition.transitionId);
  if (localAiSuccessTransitions.length > 0) {
    addIssue(context, "transitions", `routePlanBoundMap must let Route Plan own AI success routing: ${localAiSuccessTransitions.join(", ")}.`);
  }

  const routePlanPromptContractIds = new Set(routePlan.promptContractIds);
  const hasBoundAiPrompt = value.steps.some((step) =>
    step.targetAbilityGroupId === "ai"
    && typeof step.promptContractId === "string"
    && routePlanPromptContractIds.has(step.promptContractId)
  );
  if (!hasBoundAiPrompt) {
    addIssue(context, "steps", "routePlanBoundMap must bind an AI step to a Prompt Contract owned by its Route Plan.");
  }
};

const validateMapKindBoundary = (
  value: OperationalMapValue,
  routePlan: ReturnType<typeof findRoutePlanById>,
  context: z.RefinementCtx,
): void => {
  if (value.mapKind === "genericDiagnosticMap") {
    if (value.routePlanId !== null && value.routePlanId !== undefined) {
      addIssue(context, "routePlanId", "genericDiagnosticMap must not bind a Route Plan.");
    }
    return;
  }

  if (!value.routePlanId) {
    addIssue(context, "routePlanId", "routePlanBoundMap must declare routePlanId.");
    return;
  }
  if (!routePlan) {
    addIssue(context, "routePlanId", "routePlanBoundMap routePlanId must resolve to a governed Route Plan.");
    return;
  }
  validateRoutePlanBoundMap(value, routePlan, context);
};

export const validateMapPluginOperationalMap = (value: OperationalMapValue, context: z.RefinementCtx): void => {
  const routePlan = findRoutePlanById(value.routePlanId ?? null);
  validateMapKindBoundary(value, routePlan, context);
  const routePlanSteps = routePlan?.steps ?? [];
  const routePlanTransitions = routePlan?.transitions ?? [];
  const stepIds = collectStepIds({ ...value, steps: [...value.steps, ...routePlanSteps] }, context);
  validateInitialStepId(value.initialStepId, stepIds, context);

  const transitions = [...value.transitions, ...routePlanTransitions];
  collectTransitionIds(transitions, stepIds, context);
  validateFinalStates(value.finalStates, transitions, context);
};
