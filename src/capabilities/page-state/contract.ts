import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateAbilityInput,
  type PageStateAbilityResult,
  type PageStateChildCapabilityId,
} from "./schema.js";

export {
  PAGE_STATE_ABILITY_GROUP_ID,
  PAGE_STATE_CHILD_CAPABILITY_IDS,
  PageStateAbilityInputSchema,
  PageStateAbilityResultSchema,
  createPageStateChildInputSchema,
  createPageStateChildOutputSchema,
  PageStateChildCapabilityIdSchema,
  PageStateChildDetectionSchema,
  PageStateConfidencePolicySchema,
  PageStateDecisionSchema,
  PageStateFailureReasonSchema,
  PageStateFreshnessPolicySchema,
  PageStateOpenHandoffPolicySchema,
  PageStateObservationSchema,
  PageStateOutputSchema,
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
  PageStateOutput,
  PageStatePolicy,
  PageStateRuntimeProof,
  PageStateSnapshot,
  PageStateStatus,
  PageStateType,
} from "./schema.js";

export type { PageStateChildCapability } from "./runtime/page-state-child-contract.js";

export type PageStateAbilityGroupId = typeof PAGE_STATE_ABILITY_GROUP_ID;

export interface PageStateAbilityGroup {
  listChildCapabilityIds(): PageStateChildCapabilityId[];
  execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>;
}