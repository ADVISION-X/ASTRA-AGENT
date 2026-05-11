import type { RuntimePlan } from "../contract.js";

type OperationalStep = RuntimePlan["steps"][number];
type OperationalTransition = RuntimePlan["transitions"][number];

export const getEffectiveOperationalSteps = (map: RuntimePlan): OperationalStep[] => map.steps;

export const getEffectiveOperationalTransitions = (map: RuntimePlan): OperationalTransition[] => map.transitions;

export const findEffectiveOperationalStep = (map: RuntimePlan, stepId: string): OperationalStep | null =>
  getEffectiveOperationalSteps(map).find((candidate) => candidate.stepId === stepId) ?? null;
