import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import {
  createPostActionFailureResult,
  createSuccessfulPostActionResult,
} from "./post-action-result-builders.js";

export async function executePostActionVerification(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  capability: PostActionVerificationChildCapability;
}): Promise<PostActionVerificationAbilityResult> {
  const startedAt = input.context.clock.now();
  const childObservation = await input.capability.execute(input.request, input.context);
  if (childObservation.supportingObservationRefs.length === 0) {
    return createPostActionFailureResult({
      request: input.request,
      context: input.context,
      status: "review_required",
      failureReason: "missing_observation_support",
      reviewRequiredReason: childObservation.reviewRequiredReason ?? "Post Action Verification can only forward governed observation bundles with supporting observations.",
      statusMessage: childObservation.statusMessage,
    });
  }

  return createSuccessfulPostActionResult({
    request: input.request,
    childObservation,
    startedAt,
    endedAt: input.context.clock.now(),
  });
}