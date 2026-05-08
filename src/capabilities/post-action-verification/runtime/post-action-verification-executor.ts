import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import { evaluatePostActionObservationBundleGate } from "./post-action-decision-gate.js";
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
  const gateResult = evaluatePostActionObservationBundleGate({
    request: input.request,
    context: input.context,
    childObservation,
  });

  if (gateResult.status !== "success") {
    return createPostActionFailureResult({
      request: input.request,
      context: input.context,
      status: gateResult.status,
      failureReason: gateResult.failureReason,
      reviewRequiredReason: gateResult.reviewRequiredReason,
      statusMessage: childObservation.statusMessage,
      dataQualityFlags: gateResult.dataQualityFlags,
    });
  }

  return createSuccessfulPostActionResult({
    request: input.request,
    childObservation,
    startedAt,
    endedAt: input.context.clock.now(),
  });
}
