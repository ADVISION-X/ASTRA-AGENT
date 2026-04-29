import type { GeometryGuardCheckDecision, GeometryGuardFailureReason, GeometryGuardSafetyPolicy } from "../contract.js";

export const DEFAULT_CLICK_SAFETY_MARGIN_PX = 4;

export type GeometryPolicyDecisionState = {
  policyDecision: GeometryGuardCheckDecision;
  failureReason: GeometryGuardFailureReason | null;
  reviewRequiredReason: GeometryGuardFailureReason | null;
};

export function resolveClickSafetyMarginPx(policy: GeometryGuardSafetyPolicy): number {
  return Math.max(0, policy.clickSafetyMarginPx);
}

export function createPolicyPass(): GeometryPolicyDecisionState {
  return {
    policyDecision: "passed",
    failureReason: null,
    reviewRequiredReason: null,
  };
}