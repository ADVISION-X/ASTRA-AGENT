import type { OperationalMap } from "../contract.js";
import { OperationalMapSchema } from "../schema.js";

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

function checkForbiddenStepOwnerValues(map: OperationalMap): string | null {
  for (const step of map.steps) {
    if ("targetAbilityGroupId" in step && step.targetAbilityGroupId) {
      const abilityGroupId = step.targetAbilityGroupId as string;
      for (const forbidden of FORBIDDEN_OWNER_VALUES) {
        if (abilityGroupId === forbidden) {
          return `Step "${step.stepId}" references forbidden targetAbilityGroupId "${forbidden}".`;
        }
      }
    }
    if ("promptContractId" in step && step.promptContractId) {
      const promptContractId = step.promptContractId as string;
      for (const forbidden of FORBIDDEN_OWNER_VALUES) {
        if (promptContractId.includes(forbidden)) {
          return `Step "${step.stepId}" promptContractId "${promptContractId}" references forbidden owner "${forbidden}".`;
        }
      }
    }
    if ("transitionOwner" in step && step.transitionOwner) {
      const transitionOwner = step.transitionOwner as string;
      for (const forbidden of FORBIDDEN_OWNER_VALUES) {
        if (transitionOwner === forbidden) {
          return `Step "${step.stepId}" transitionOwner "${transitionOwner}" is forbidden.`;
        }
      }
    }
  }

  return null;
}

function checkForbiddenTransitionOwnerValues(map: OperationalMap): string | null {
  for (const transition of map.transitions) {
    if ("decisionOwner" in transition && transition.decisionOwner) {
      const decisionOwner = transition.decisionOwner as string;
      for (const forbidden of FORBIDDEN_OWNER_VALUES) {
        if (decisionOwner === forbidden) {
          return `Transition "${transition.transitionId}" decisionOwner "${decisionOwner}" is forbidden.`;
        }
      }
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
