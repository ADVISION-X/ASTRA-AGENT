import { POST_ACTION_OBSERVATION_SOURCE_ALLOWLIST } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

function createObservationBindingFailure(statusMessage: string, decision: "failed:duplicate_observation_ref" | "failed:forbidden_observation_source_ability" | "failed:forbidden_observation_source_child" | "review_required:observation_source_proof_unverified") {
  return {
    ok: false as const,
    status: decision.startsWith("review_required") ? "review_required" as const : "failed" as const,
    failureReason: "observation_binding_conflict" as const,
    reviewRequiredReason: decision.startsWith("review_required") ? statusMessage : null,
    statusMessage,
    dataQualityFlags: ["observation_binding_conflict"],
    observationBindingDecision: decision,
  };
}

function validateObservationBindingEntry(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  observation: ParsedPostActionVerificationAbilityInput["observationSet"]["observations"][number];
}) {
  const allowlist = POST_ACTION_OBSERVATION_SOURCE_ALLOWLIST[input.observation.kind];
  if (!(allowlist.sourceAbilityGroupIds as readonly string[]).includes(input.observation.source.sourceAbilityGroupId)) {
    return createObservationBindingFailure(
      `Observation ${input.observation.ref} source ability is not allowed for ${input.observation.kind}.`,
      "failed:forbidden_observation_source_ability",
    );
  }

  if (!(allowlist.sourceChildCapabilityIds as readonly string[]).includes(input.observation.source.sourceChildCapabilityId)) {
    return createObservationBindingFailure(
      `Observation ${input.observation.ref} source child is not allowed for ${input.observation.kind}.`,
      "failed:forbidden_observation_source_child",
    );
  }

  if (!input.context.evidenceReadPort.verifyProofRef(input.request, input.observation.source.sourceProofRef)) {
    return createObservationBindingFailure(
      `Observation ${input.observation.ref} proof binding could not be verified.`,
      "review_required:observation_source_proof_unverified",
    );
  }

  return null;
}

export function validateObservationProofBinding(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}) {
  const seenRefs = new Set<string>();

  for (const observation of input.request.observationSet.observations) {
    if (seenRefs.has(observation.ref)) {
      return createObservationBindingFailure(`Observation ref ${observation.ref} must be unique.`, "failed:duplicate_observation_ref");
    }
    seenRefs.add(observation.ref);
    const failure = validateObservationBindingEntry({ request: input.request, context: input.context, observation });
    if (failure) {
      return failure;
    }
  }

  return {
    ok: true,
    observationBindingDecision: "allow" as const,
  };
}