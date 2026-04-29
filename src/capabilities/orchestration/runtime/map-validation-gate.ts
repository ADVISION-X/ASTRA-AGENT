import type { OperationalMap } from "../contract.js";
import { OperationalMapSchema } from "../schema.js";

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

export function validateOperationalMapGate(map: OperationalMap): OperationalMap {
  const parsed = OperationalMapSchema.parse(map);
  const reachableSteps = collectReachableSteps(parsed);
  if (!reachableSteps.has(parsed.initialStepId)) {
    throw new Error(`Operational map ${parsed.mapId} cannot reach its initial step.`);
  }
  for (const step of parsed.steps) {
    if (!reachableSteps.has(step.stepId)) {
      throw new Error(`Operational map ${parsed.mapId} contains unreachable step ${step.stepId}.`);
    }
  }
  if (parsed.allowedAbilityGroups.includes("ai") && parsed.steps.every((step) => step.stepKind !== "ai")) {
    throw new Error(`Operational map ${parsed.mapId} allows ai but declares no AI steps.`);
  }
  if (JSON.stringify(parsed).includes("local-ai-decision")) {
    throw new Error(`Operational map ${parsed.mapId} still references retired local-ai-decision owner.`);
  }
  return parsed;
}