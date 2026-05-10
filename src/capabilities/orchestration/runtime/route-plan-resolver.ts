import type { OperationalMap } from "../contract.js";

type OperationalStep = OperationalMap["steps"][number];
type OperationalTransition = OperationalMap["transitions"][number];

export const getEffectiveOperationalSteps = (map: OperationalMap): OperationalStep[] => map.steps;

export const getEffectiveOperationalTransitions = (map: OperationalMap): OperationalTransition[] => map.transitions;

export const findEffectiveOperationalStep = (map: OperationalMap, stepId: string): OperationalStep | null =>
  getEffectiveOperationalSteps(map).find((candidate) => candidate.stepId === stepId) ?? null;
