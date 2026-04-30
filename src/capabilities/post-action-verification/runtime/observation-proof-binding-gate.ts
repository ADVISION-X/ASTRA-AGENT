import { POST_ACTION_OBSERVATION_SOURCE_ALLOWLIST } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

export function validateObservationProofBinding(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}) {
  const seenRefs = new Set<string>();

  for (const observation of input.request.observationSet.observations) {
    if (seenRefs.has(observation.ref)) {
      return {
        ok: false,
        status: "failed" as const,
        failureReason: "observation_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation ref ${observation.ref} must be unique.`,
        dataQualityFlags: ["observation_binding_conflict"],
        observationBindingDecision: "failed:duplicate_observation_ref" as const,
      };
    }
    seenRefs.add(observation.ref);

    const allowlist = POST_ACTION_OBSERVATION_SOURCE_ALLOWLIST[observation.kind];
    const sourceAbilityGroupIds: readonly string[] = allowlist.sourceAbilityGroupIds;
    const sourceChildCapabilityIds: readonly string[] = allowlist.sourceChildCapabilityIds;
    if (!sourceAbilityGroupIds.includes(observation.source.sourceAbilityGroupId)) {
      return {
        ok: false,
        status: "failed" as const,
        failureReason: "observation_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation ${observation.ref} source ability is not allowed for ${observation.kind}.`,
        dataQualityFlags: ["observation_binding_conflict"],
        observationBindingDecision: "failed:forbidden_observation_source_ability" as const,
      };
    }

    if (!sourceChildCapabilityIds.includes(observation.source.sourceChildCapabilityId)) {
      return {
        ok: false,
        status: "failed" as const,
        failureReason: "observation_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation ${observation.ref} source child is not allowed for ${observation.kind}.`,
        dataQualityFlags: ["observation_binding_conflict"],
        observationBindingDecision: "failed:forbidden_observation_source_child" as const,
      };
    }

    if (!input.context.evidenceReadPort.verifyProofRef(input.request, observation.source.sourceProofRef)) {
      return {
        ok: false,
        status: "review_required" as const,
        failureReason: "observation_binding_conflict" as const,
        reviewRequiredReason: `Observation ${observation.ref} proof ref is not bound to the governed proof chain.`,
        statusMessage: `Observation ${observation.ref} proof binding could not be verified.`,
        dataQualityFlags: ["observation_binding_conflict"],
        observationBindingDecision: "review_required:observation_source_proof_unverified" as const,
      };
    }
  }

  return {
    ok: true,
    observationBindingDecision: "allow" as const,
  };
}