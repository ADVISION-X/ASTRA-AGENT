import type { OperationalMap } from "../contract.js";

import {
  findEffectiveOperationalStep,
  getEffectiveOperationalSteps,
  getEffectiveOperationalTransitions,
} from "./route-plan-resolver.js";

type OperationalStep = OperationalMap["steps"][number];

const POST_ACTION_VERIFICATION_REQUIRED_GROUPS = new Set([
  "open",
  "mouse-click",
  "mouse-scroll",
  "text-input",
]);

export function requiresPostActionVerificationAbilityGroup(targetAbilityGroupId: string | null | undefined): boolean {
  return targetAbilityGroupId !== null
    && targetAbilityGroupId !== undefined
    && POST_ACTION_VERIFICATION_REQUIRED_GROUPS.has(targetAbilityGroupId);
}

export function isPostActionVerificationStep(step: OperationalStep): boolean {
  return step.targetAbilityGroupId === "post-action-verification";
}

function requiresPostActionVerificationStep(step: OperationalStep): boolean {
  return step.stepKind === "ability" && requiresPostActionVerificationAbilityGroup(step.targetAbilityGroupId);
}

function hasPostActionVerificationSuccessTransition(map: OperationalMap, stepId: string): boolean {
  const effectiveSteps = getEffectiveOperationalSteps(map);
  const effectiveTransitions = getEffectiveOperationalTransitions(map);
  return effectiveTransitions.some((transition) => transition.fromStepId === stepId
    && transition.onStatus === "success"
    && transition.toStepId !== null
    && effectiveSteps.some((step) => step.stepId === transition.toStepId && isPostActionVerificationStep(step)));
}

export function ensurePostActionVerificationPolicy(map: OperationalMap): string | null {
  for (const step of getEffectiveOperationalSteps(map)) {
    if (requiresPostActionVerificationStep(step) && !hasPostActionVerificationSuccessTransition(map, step.stepId)) {
      return `Action step "${step.stepId}" must transition to a governed post-action-verification step on success.`;
    }
  }

  return null;
}

export function ensurePostActionVerificationDispatchGate(map: OperationalMap, stepId: string): string | null {
  const step = findEffectiveOperationalStep(map, stepId);
  if (!step || !requiresPostActionVerificationStep(step)) {
    return null;
  }

  return hasPostActionVerificationSuccessTransition(map, stepId)
    ? null
    : `Action step "${stepId}" cannot dispatch because no governed post-action-verification step closes its success path.`;
}
