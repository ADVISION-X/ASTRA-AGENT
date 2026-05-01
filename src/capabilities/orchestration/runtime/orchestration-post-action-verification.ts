import type { OperationalMap } from "../contract.js";

const STATE_CHANGING_ABILITY_GROUP_IDS = new Set([
  "open",
  "mouse-click",
  "mouse-scroll",
  "text-input",
]);

function findStep(map: OperationalMap, stepId: string) {
  return map.steps.find((candidate) => candidate.stepId === stepId) ?? null;
}

function isStateChangingActionStep(step: OperationalMap["steps"][number]): boolean {
  const targetAbilityGroupId = step.targetAbilityGroupId;
  return step.stepKind === "ability"
    && targetAbilityGroupId !== null
    && STATE_CHANGING_ABILITY_GROUP_IDS.has(targetAbilityGroupId);
}

function isPostActionVerificationStep(step: OperationalMap["steps"][number] | null): boolean {
  return Boolean(step)
    && step!.stepKind === "ability"
    && step!.targetAbilityGroupId === "post-action-verification";
}

function hasVerificationSuccessTransition(map: OperationalMap, step: OperationalMap["steps"][number]): boolean {
  return map.transitions.some((transition) => {
    if (transition.fromStepId !== step.stepId || transition.onStatus !== "success" || !transition.toStepId) {
      return false;
    }
    return isPostActionVerificationStep(findStep(map, transition.toStepId));
  });
}

function buildVerificationFailure(step: OperationalMap["steps"][number]): string {
  return `State-changing step "${step.stepId}" must transition to a post-action-verification step on success.`;
}

export function ensurePostActionVerificationPolicy(map: OperationalMap): string | null {
  for (const step of map.steps) {
    if (isStateChangingActionStep(step) && !hasVerificationSuccessTransition(map, step)) {
      return buildVerificationFailure(step);
    }
  }

  return null;
}

export function ensurePostActionVerificationDispatchGate(map: OperationalMap, stepId: string): string | null {
  const step = findStep(map, stepId);
  if (!step || !isStateChangingActionStep(step)) {
    return null;
  }
  return hasVerificationSuccessTransition(map, step) ? null : buildVerificationFailure(step);
}