import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput, PageStateAbilityResult } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import {
  createPageStateFailureResult,
  createSuccessfulPageStateResult,
} from "./page-state-result-builders.js";

export async function executePageState(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  clock: PageStateClockPort;
}): Promise<PageStateAbilityResult> {
  const startedAt = input.clock.now();

  const childObservation = await input.childCapability.execute(input.request);
  if (input.request.sourceEvidenceRefs.length === 0 || childObservation.supportingEvidenceRefs.length === 0) {
    return createPageStateFailureResult({
      request: input.request,
      failureReason: "missing_source_evidence",
      reviewRequiredReason: "Page State can only forward governed observation bundles with evidence references.",
      status: "review_required",
      clock: input.clock,
    });
  }

  if (childObservation.matchedObservationIds.length === 0) {
    return createPageStateFailureResult({
      request: input.request,
      failureReason: "missing_observation_support",
      reviewRequiredReason: childObservation.reviewRequiredReason ?? "No governed observations were packaged for AI review.",
      status: "review_required",
      clock: input.clock,
    });
  }

  return createSuccessfulPageStateResult({
    request: input.request,
    childObservation,
    startedAt,
    endedAt: input.clock.now(),
  });
}