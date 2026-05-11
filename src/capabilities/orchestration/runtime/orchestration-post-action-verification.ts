import type { RuntimePlan } from "../contract.js";

type OperationalStep = RuntimePlan["steps"][number];

const POST_CLICK_OBSERVATION_GROUPS = new Set([
  "open",
  "mouse-click",
  "mouse-scroll",
  "text-input",
]);

export function allowsPostClickObservationAbilityGroup(targetAbilityGroupId: string | null | undefined): boolean {
  return targetAbilityGroupId !== null
    && targetAbilityGroupId !== undefined
    && POST_CLICK_OBSERVATION_GROUPS.has(targetAbilityGroupId);
}

export function isPostActionVerificationStep(step: OperationalStep): boolean {
  return step.targetAbilityGroupId === "post-action-verification";
}

export function ensurePostActionVerificationPolicy(map: RuntimePlan): string | null {
  void map;
  return null;
}

export function ensurePostActionVerificationDispatchGate(map: RuntimePlan, stepId: string): string | null {
  void map;
  void stepId;
  return null;
}
