import type { RuntimePlan } from "../contract.js";
import { RuntimePlanSchema } from "../schema.js";
import { ensurePostActionVerificationPolicy } from "./orchestration-post-action-verification.js";

const FORBIDDEN_OWNER_VALUES = ["local-ai-decision"];

function buildAdjacency(map: RuntimePlan): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const step of map.steps) {
    adjacency.set(step.stepId, []);
  }
  for (const transition of map.transitions) {
    if (transition.toStepId) {
      adjacency.get(transition.fromStepId)?.push(transition.toStepId);
    }
  }
  return adjacency;
}

function collectReachableSteps(map: RuntimePlan): Set<string> {
  const adjacency = buildAdjacency(map);
  const queue = [map.initialStepId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const stepId = queue.shift();
    if (!stepId || visited.has(stepId)) {
      continue;
    }
    visited.add(stepId);
    for (const nextStepId of adjacency.get(stepId) ?? []) {
      if (!visited.has(nextStepId)) {
        queue.push(nextStepId);
      }
    }
  }
  return visited;
}

function validateReachableSteps(map: RuntimePlan): string | null {
  const reachableSteps = collectReachableSteps(map);
  if (!reachableSteps.has(map.initialStepId)) {
    return `Runtime plan ${map.mapId} cannot reach its initial step.`;
  }

  for (const step of map.steps) {
    if (!reachableSteps.has(step.stepId)) {
      return `Runtime plan ${map.mapId} contains unreachable step ${step.stepId}.`;
    }
  }

  return null;
}

function resolveForbiddenOwnerValue(candidate: string | null | undefined, matchMode: "equals" | "includes"): string | null {
  if (!candidate) {
    return null;
  }

  for (const forbidden of FORBIDDEN_OWNER_VALUES) {
    const matches = matchMode === "includes" ? candidate.includes(forbidden) : candidate === forbidden;
    if (matches) {
      return forbidden;
    }
  }

  return null;
}

function resolveForbiddenStepOwnerReason(step: RuntimePlan["steps"][number]): string | null {
  const targetAbilityGroupId = "targetAbilityGroupId" in step ? step.targetAbilityGroupId : null;
  const targetForbiddenOwner = resolveForbiddenOwnerValue(targetAbilityGroupId as string | null | undefined, "equals");
  if (targetForbiddenOwner) {
    return `Step "${step.stepId}" references forbidden targetAbilityGroupId "${targetForbiddenOwner}".`;
  }

  const promptContractId = "promptContractId" in step ? step.promptContractId : null;
  const promptForbiddenOwner = resolveForbiddenOwnerValue(promptContractId as string | null | undefined, "includes");
  if (promptForbiddenOwner) {
    return `Step "${step.stepId}" promptContractId "${promptContractId}" references forbidden owner "${promptForbiddenOwner}".`;
  }

  const transitionOwner = "transitionOwner" in step ? step.transitionOwner : null;
  const transitionForbiddenOwner = resolveForbiddenOwnerValue(transitionOwner as string | null | undefined, "equals");
  if (transitionForbiddenOwner) {
    return `Step "${step.stepId}" transitionOwner "${transitionOwner}" is forbidden.`;
  }

  return null;
}

function resolveForbiddenTransitionOwnerReason(transition: RuntimePlan["transitions"][number]): string | null {
  const decisionOwner = "decisionOwner" in transition ? transition.decisionOwner : null;
  const forbiddenOwner = resolveForbiddenOwnerValue(decisionOwner as string | null | undefined, "equals");
  if (forbiddenOwner) {
    return `Transition "${transition.transitionId}" decisionOwner "${decisionOwner}" is forbidden.`;
  }

  return null;
}

function checkForbiddenStepOwnerValues(map: RuntimePlan): string | null {
  for (const step of map.steps) {
    const forbiddenReason = resolveForbiddenStepOwnerReason(step);
    if (forbiddenReason) {
      return forbiddenReason;
    }
  }

  return null;
}

function checkForbiddenTransitionOwnerValues(map: RuntimePlan): string | null {
  for (const transition of map.transitions) {
    const forbiddenReason = resolveForbiddenTransitionOwnerReason(transition);
    if (forbiddenReason) {
      return forbiddenReason;
    }
  }
  return null;
}

function validateRuntimePlanStructure(map: RuntimePlan): string | null {
  const reachableReason = validateReachableSteps(map);
  if (reachableReason) {
    return reachableReason;
  }

  return checkForbiddenStepOwnerValues(map)
    ?? checkForbiddenTransitionOwnerValues(map);
}

export type RuntimePlanValidationResult =
  | { valid: true; map: RuntimePlan }
  | { valid: false; failureReason: string };

export function validateRuntimePlanGate(map: RuntimePlan): RuntimePlanValidationResult {
  const parseResult = RuntimePlanSchema.safeParse(map);
  if (!parseResult.success) {
    return { valid: false, failureReason: parseResult.error.message };
  }
  const parsed = parseResult.data;

  const forbiddenReason = validateRuntimePlanStructure(parsed);
  if (forbiddenReason) {
    return { valid: false, failureReason: forbiddenReason };
  }

  const postActionVerificationReason = ensurePostActionVerificationPolicy(parsed);
  if (postActionVerificationReason) {
    return { valid: false, failureReason: postActionVerificationReason };
  }

  return { valid: true, map: parsed };
}