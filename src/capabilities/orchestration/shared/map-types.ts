import type { AbilityTargetId } from "../../nerve-bus/index.js";

export type OperationalMapId = "facebook-product-discovery-map" | "tiktok-product-discovery-map";
export type MissionStatus = "running" | "completed" | "failed" | "review_required";
export type TransitionOutcome = "success" | "failure" | "review";
export type TransitionConditionSource = "status" | "decision" | "payload";

export type TransitionCondition = {
  source: TransitionConditionSource;
  field: string;
  equals: string | boolean | null;
};

export type OperationalMapStep = {
  stepId: string;
  commandName: string;
  targetAbilityGroupId: AbilityTargetId;
  inputRefs: string[];
  successCondition: TransitionCondition;
  successNextStepId: string | null;
  failureNextStepId: string | null;
  reviewNextStepId: string | null;
};

export type MapTransition = {
  fromStepId: string;
  outcome: TransitionOutcome;
  condition: TransitionCondition;
  toStepId: string | null;
  finalStatus?: Exclude<MissionStatus, "running">;
};

export type OperationalMap = {
  mapId: OperationalMapId;
  displayName: string;
  humanGoal: string;
  priority: "primary" | "diagnostic";
  allowedAbilityGroups: AbilityTargetId[];
  initialStepId: string;
  steps: OperationalMapStep[];
  transitions: MapTransition[];
  failureBranches: string[];
  reviewBranches: string[];
  finalStates: Exclude<MissionStatus, "running">[];
  forbiddenDirectCalls: string[];
};

export function validateOperationalMap(map: OperationalMap): void {
  const stepIds = new Set(map.steps.map((step) => step.stepId));

  if (!stepIds.has(map.initialStepId)) {
    throw new Error(`Operational map ${map.mapId} is missing initial step ${map.initialStepId}`);
  }

  for (const transition of map.transitions) {
    if (!stepIds.has(transition.fromStepId)) {
      throw new Error(`Operational map ${map.mapId} has transition from unknown step ${transition.fromStepId}`);
    }

    if (transition.toStepId !== null && !stepIds.has(transition.toStepId)) {
      throw new Error(`Operational map ${map.mapId} has transition to unknown step ${transition.toStepId}`);
    }
  }
}