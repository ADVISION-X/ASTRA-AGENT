import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyTargetStateChangedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyTargetStateChangedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-target-state-changed" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const visualTarget = getObservationsByKind(observations, "visual_target")[0] ?? null;
      const screenshotDiff = getObservationsByKind(observations, "screenshot_diff")[0] ?? null;
      const pageState = getObservationsByKind(observations, "page_state")[0] ?? null;
      const screenshotSignal = screenshotDiff?.payload.targetStateChanged ?? null;
      const visualSignal = visualTarget?.payload.targetStateChanged ?? null;
      const pageSignal = pageState?.payload.targetStateChanged ?? null;
      const changed = screenshotSignal === true && (visualSignal === true || pageSignal === true)
        ? true
        : screenshotSignal === false && visualSignal === false
          ? false
          : null;

      if (changed === null) {
        return VerifyTargetStateChangedOutputSchema.parse({
          observedOutcome: "target_state_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Target-state verification requires governed before/after visual or page-state evidence.",
          statusMessage: "Target-state verification could not determine whether the target changed state.",
          dataQualityFlags: ["target_state_unknown"],
          supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
          supportingObservationRefs: [visualTarget?.ref, screenshotDiff?.ref, pageState?.ref].filter((value): value is string => value !== null),
          supportingSourceProofRefs: [visualTarget?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, pageState?.source.sourceProofRef].filter((value): value is string => value !== null),
          verifiedByEvidenceKinds: ["visual_target", "screenshot_diff", "page_state"],
          confidenceSource: "before_after_target_state_alignment",
        });
      }

      const observedTargetType = visualTarget?.payload.targetType ?? pageState?.payload.targetType ?? input.expectedOutcome.expectedTargetType ?? "unknown";
      return VerifyTargetStateChangedOutputSchema.parse({
        observedOutcome: changed ? `target_state_changed:${observedTargetType}` : `target_state_unchanged:${observedTargetType}`,
        verificationDecision: changed ? "verified" : "failed",
        confidence: changed ? 0.9 : 0.88,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        statusMessage: changed ? "Target state changed after the click." : "Target state did not change after the click.",
        dataQualityFlags: [],
        supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
        supportingObservationRefs: [visualTarget?.ref, screenshotDiff?.ref, pageState?.ref].filter((value): value is string => value !== null),
        supportingSourceProofRefs: [visualTarget?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, pageState?.source.sourceProofRef].filter((value): value is string => value !== null),
        verifiedByEvidenceKinds: ["visual_target", "screenshot_diff", "page_state"],
        confidenceSource: "before_after_target_state_alignment",
      });
    },
  };
}
