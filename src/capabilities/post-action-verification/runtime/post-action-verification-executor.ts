import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import { evaluatePostActionDecisionGate } from "./post-action-decision-gate.js";
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
      status: "failed",
      verificationDecision: "failed",
      confidence: childObservation.confidence,
      failureReason: "missing_observation_support",
      reviewRequiredReason: null,
      statusMessage: childObservation.statusMessage,
      dataQualityFlags: [...childObservation.dataQualityFlags, "missing_observation"],
      gateDecisions: ["observation_support_gate:failed"],
      verificationDecisionTrace: ["missing supporting observations"],
    });
  }

  const gateResult = evaluatePostActionDecisionGate({
    request: input.request,
    context: input.context,
    childObservation,
  });

  if (gateResult.status !== "success") {
    return createPostActionFailureResult({
      request: input.request,
      context: input.context,
      status: gateResult.status,
      verificationDecision: gateResult.verificationDecision,
      confidence: gateResult.confidence,
      failureReason: gateResult.failureReason,
      reviewRequiredReason: gateResult.reviewRequiredReason,
      statusMessage: childObservation.statusMessage,
      dataQualityFlags: gateResult.dataQualityFlags,
      gateDecisions: gateResult.gateDecisions,
      verificationDecisionTrace: gateResult.verificationDecisionTrace,
    });
  }

  return createSuccessfulPostActionResult({
    request: input.request,
    childObservation,
    gateDecisions: gateResult.gateDecisions,
    verificationDecisionTrace: gateResult.verificationDecisionTrace,
    startedAt,
    endedAt: input.context.clock.now(),
  });
}
