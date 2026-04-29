import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateAbilityInput,
  type PageStateAbilityResult,
  type PageStateChildCapabilityId,
  type PageStateChildDetection,
} from "./schema.js";

export {
  PAGE_STATE_ABILITY_GROUP_ID,
  PAGE_STATE_CHILD_CAPABILITY_IDS,
  PageStateAbilityInputSchema,
  PageStateAbilityResultSchema,
  createPageStateChildInputSchema,
  createPageStateChildOutputSchema,
  PageStateChildDetectionSchema,
  PageStateChildCapabilityIdSchema,
  PageStateConfidencePolicySchema,
  PageStateDecisionSchema,
  PageStateFailureReasonSchema,
  PageStateFreshnessPolicySchema,
  PageStateOpenHandoffPolicySchema,
  PageStateObservationSchema,
  PageStatePolicySchema,
  PageStateRuntimeProofSchema,
  PageStateSnapshotSchema,
  PageStateStatusSchema,
  PageStateTypeSchema,
} from "./schema.js";

export type {
  PageStateAbilityInput,
  PageStateAbilityResult,
  PageStateChildCapabilityId,
  PageStateChildDetection,
  PageStateConfidencePolicy,
  PageStateDataQualityFlag,
  PageStateDecision,
  PageStateFailureReason,
  PageStateFreshnessPolicy,
  PageStateObservation,
  PageStateOpenHandoffPolicy,
  PageStatePolicy,
  PageStateRuntimeProof,
  PageStateSnapshot,
  PageStateStatus,
  PageStateType,
} from "./schema.js";

export type PageStateAbilityGroupId = typeof PAGE_STATE_ABILITY_GROUP_ID;

export interface PageStateChildCapability {
  readonly abilityGroupId: PageStateAbilityGroupId;
  readonly childCapabilityId: PageStateChildCapabilityId;

  execute(input: PageStateAbilityInput): Promise<PageStateChildDetection>;
}

export interface PageStateAbilityGroup {
  listChildCapabilityIds(): PageStateChildCapabilityId[];
  execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>;
}