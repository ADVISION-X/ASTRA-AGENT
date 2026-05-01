import type { OperationalMap } from "../contract.js";
import { OperationalMapSchema } from "../schema.js";
import { ensurePostActionVerificationPolicy } from "./orchestration-post-action-verification.js";

const FORBIDDEN_OWNER_VALUES = ["local-ai-decision"];

function buildAdjacency(map: OperationalMap): Map<string, string[]> {
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

function collectReachableSteps(map: OperationalMap): Set<string> {
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

function validateReachableSteps(map: OperationalMap): string | null {
  const reachableSteps = collectReachableSteps(map);
  if (!reachableSteps.has(map.initialStepId)) {
    return `Operational map ${map.mapId} cannot reach its initial step.`;
  }

  for (const step of map.steps) {
    if (!reachableSteps.has(step.stepId)) {
      return `Operational map ${map.mapId} contains unreachable step ${step.stepId}.`;
    }
  }

  return null;
}

function validateAllowedAbilityGroups(map: OperationalMap): string | null {
  if (map.allowedAbilityGroups.includes("ai") && map.steps.every((step) => step.stepKind !== "ai")) {
    return `Operational map ${map.mapId} allows ai but declares no AI steps.`;
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

function resolveForbiddenStepOwnerReason(step: OperationalMap["steps"][number]): string | null {
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

function resolveForbiddenTransitionOwnerReason(transition: OperationalMap["transitions"][number]): string | null {
  const decisionOwner = "decisionOwner" in transition ? transition.decisionOwner : null;
  const forbiddenOwner = resolveForbiddenOwnerValue(decisionOwner as string | null | undefined, "equals");
  if (forbiddenOwner) {
    return `Transition "${transition.transitionId}" decisionOwner "${decisionOwner}" is forbidden.`;
  }

  return null;
}

function checkForbiddenStepOwnerValues(map: OperationalMap): string | null {
  for (const step of map.steps) {
    const forbiddenReason = resolveForbiddenStepOwnerReason(step);
    if (forbiddenReason) {
      return forbiddenReason;
    }
  }

  return null;
}

function checkForbiddenTransitionOwnerValues(map: OperationalMap): string | null {
  for (const transition of map.transitions) {
    const forbiddenReason = resolveForbiddenTransitionOwnerReason(transition);
    if (forbiddenReason) {
      return forbiddenReason;
    }
  }
  return null;
}

function validateOperationalMapStructure(map: OperationalMap): string | null {
  const reachableReason = validateReachableSteps(map);
  if (reachableReason) {
    return reachableReason;
  }

  const abilityGroupReason = validateAllowedAbilityGroups(map);
  if (abilityGroupReason) {
    return abilityGroupReason;
  }

  const postActionVerificationReason = ensurePostActionVerificationPolicy(map);
  if (postActionVerificationReason) {
    return postActionVerificationReason;
  }

  return checkForbiddenStepOwnerValues(map) ?? checkForbiddenTransitionOwnerValues(map);
}

export type MapValidationResult =
  | { valid: true; map: OperationalMap }
  | { valid: false; failureReason: string };

export function validateOperationalMapGate(map: OperationalMap): MapValidationResult {
  const parseResult = OperationalMapSchema.safeParse(map);
  if (!parseResult.success) {
    return { valid: false, failureReason: parseResult.error.message };
  }
  const parsed = parseResult.data;

  const forbiddenReason = validateOperationalMapStructure(parsed);
  if (forbiddenReason) {
    return { valid: false, failureReason: forbiddenReason };
  }

  return { valid: true, map: parsed };
}
