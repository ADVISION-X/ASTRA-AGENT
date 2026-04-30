import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import { createPageStateFingerprint } from "./page-state-fingerprint.js";
import { dispatchPageStateFailure } from "./page-state-dispatch-failure.js";
import { gatePageStatePayloadBudget } from "./page-state-payload-budget-gate.js";
import { gateObservationSources } from "./observation-source-gate.js";
import { gateObservationProofBinding } from "./observation-proof-binding-gate.js";
import { buildPageStateRuntimeProof } from "./page-state-proof-builder.js";
import { buildPageStateResult } from "./page-state-result-builder.js";
import { gatePlatformProfile } from "./platform-profile-gate.js";
import { decideProceed } from "./proceed-decision-gate.js";
import { gatePageStateInput } from "./page-state-input-gate.js";
import { gateSnapshotFreshness } from "./snapshot-freshness-gate.js";
import { classifyPageState } from "./state-classification-gate.js";

export async function executePageState(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  clock: PageStateClockPort;
  profilePort: PageStateProfilePort;
}): Promise<import("../schema.js").PageStateAbilityResult> {
  const startedAt = input.clock.now();
  const inputGate = gatePageStateInput(input.request);
  if (!inputGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: inputGate.failure.failureReason,
      stateSummary: inputGate.failure.stateSummary,
      reviewRequiredReason: inputGate.failure.reviewRequiredReason,
      pageStateType: inputGate.failure.pageStateType,
      status: inputGate.failure.status,
      decision: inputGate.failure.decision,
      dataQualityFlags: inputGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  const payloadBudgetGate = gatePageStatePayloadBudget(input.request);
  if (!payloadBudgetGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: payloadBudgetGate.failure.failureReason,
      stateSummary: payloadBudgetGate.failure.stateSummary,
      reviewRequiredReason: payloadBudgetGate.failure.reviewRequiredReason,
      pageStateType: payloadBudgetGate.failure.pageStateType,
      status: payloadBudgetGate.failure.status,
      decision: payloadBudgetGate.failure.decision,
      dataQualityFlags: payloadBudgetGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  const sourceGate = gateObservationSources(input.request);
  if (!sourceGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: sourceGate.failure.failureReason,
      stateSummary: sourceGate.failure.stateSummary,
      reviewRequiredReason: sourceGate.failure.reviewRequiredReason,
      pageStateType: sourceGate.failure.pageStateType,
      status: sourceGate.failure.status,
      decision: sourceGate.failure.decision,
      dataQualityFlags: sourceGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  const proofBindingGate = gateObservationProofBinding(input.request);
  if (!proofBindingGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: proofBindingGate.failure.failureReason,
      stateSummary: proofBindingGate.failure.stateSummary,
      reviewRequiredReason: proofBindingGate.failure.reviewRequiredReason,
      pageStateType: proofBindingGate.failure.pageStateType,
      status: proofBindingGate.failure.status,
      decision: proofBindingGate.failure.decision,
      dataQualityFlags: proofBindingGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  const freshnessGate = gateSnapshotFreshness({ request: input.request, clock: input.clock });
  if (!freshnessGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: freshnessGate.failure.failureReason,
      stateSummary: freshnessGate.failure.stateSummary,
      reviewRequiredReason: freshnessGate.failure.reviewRequiredReason,
      pageStateType: freshnessGate.failure.pageStateType,
      status: freshnessGate.failure.status,
      decision: freshnessGate.failure.decision,
      dataQualityFlags: freshnessGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  const platformGate = gatePlatformProfile({ request: input.request, profilePort: input.profilePort });
  if (!platformGate.ok) {
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: platformGate.failure.failureReason,
      stateSummary: platformGate.failure.stateSummary,
      reviewRequiredReason: platformGate.failure.reviewRequiredReason,
      pageStateType: platformGate.failure.pageStateType,
      status: platformGate.failure.status,
      decision: platformGate.failure.decision,
      dataQualityFlags: platformGate.failure.dataQualityFlags,
      clock: input.clock,
    });
  }

  try {
    const classified = await classifyPageState({
      request: input.request,
      childCapability: input.childCapability,
      resolvedProfile: platformGate.profile,
    });
    const outcome = decideProceed(classified);
    const endedAt = input.clock.now();
    const observationRefs = [...new Set([...input.request.observations.map((observation) => observation.observationId), ...outcome.matchedObservationIds])];
    const pageStateFingerprint = createPageStateFingerprint({
      request: input.request,
      pageStateType: outcome.pageStateType,
      observationRefs,
    });
    const runtimeProof = buildPageStateRuntimeProof({
      request: input.request,
      timing: { startedAt, endedAt },
      trace: {
        inputDecision: inputGate.inputDecision,
        sourceDecision: sourceGate.sourceDecision,
        payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision,
        observationBindingDecision: proofBindingGate.observationBindingDecision,
        freshnessDecision: freshnessGate.freshnessDecision,
        platformDecision: platformGate.platformDecision,
        classificationDecision: outcome.decision === "proceed" ? "proceed" : outcome.decision,
        outputBoundaryDecision: outcome.status === "success" ? "allow" : outcome.failureReason === "output_boundary_violation" ? "fail" : "review_required",
        criticalDataQualityDecision: outcome.status === "success" ? "allow" : outcome.failureReason === "low_confidence" ? "review_required" : outcome.failureReason === "insufficient_signal" ? "review_required" : "allow",
        proceedDecision: outcome.decision,
      },
      status: outcome.status,
      decision: outcome.decision,
      pageStateType: outcome.pageStateType,
      confidence: outcome.confidence,
      failureReason: outcome.failureReason,
      reviewRequiredReason: outcome.reviewRequiredReason,
      pageStateFingerprint,
      observationRefs,
      dataQualityFlags: outcome.dataQualityFlags,
      resolvedPlatformProfileId: outcome.resolvedProfileId,
      matchedHost: outcome.matchedHost,
    });
    return buildPageStateResult({
      request: input.request,
      outcome,
      runtimeProof,
      observationRefs,
      pageStateFingerprint,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown page-state execution failure.";
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: "execution_failed",
      stateSummary: `Page State execution failed: ${message}`,
      reviewRequiredReason: null,
      pageStateType: "unknown_page",
      status: "failed",
      decision: "fail",
      dataQualityFlags: ["insufficient_signal"],
      clock: input.clock,
    });
  }
}