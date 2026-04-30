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

function checkForbiddenOwnerValues(map: OperationalMap): string | null {
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

export type MapValidationResult =
  | { valid: true; map: OperationalMap }
  | { valid: false; failureReason: string };

export function validateOperationalMapGate(map: OperationalMap): MapValidationResult {
  const parseResult = OperationalMapSchema.safeParse(map);
  if (!parseResult.success) {
    return { valid: false, failureReason: parseResult.error.message };
  }
  const parsed = parseResult.data;

  const reachableSteps = collectReachableSteps(parsed);
  if (!reachableSteps.has(parsed.initialStepId)) {
    return { valid: false, failureReason: `Operational map ${parsed.mapId} cannot reach its initial step.` };
  }
  for (const step of parsed.steps) {
    if (!reachableSteps.has(step.stepId)) {
      return { valid: false, failureReason: `Operational map ${parsed.mapId} contains unreachable step ${step.stepId}.` };
    }
  }
  if (parsed.allowedAbilityGroups.includes("ai") && parsed.steps.every((step) => step.stepKind !== "ai")) {
    return { valid: false, failureReason: `Operational map ${parsed.mapId} allows ai but declares no AI steps.` };
  }

  const forbiddenReason = checkForbiddenOwnerValues(parsed);
  if (forbiddenReason) {
    return { valid: false, failureReason: forbiddenReason };
  }

  return { valid: true, map: parsed };
}
