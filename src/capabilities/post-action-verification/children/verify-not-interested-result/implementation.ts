import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyNotInterestedResultOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyNotInterestedResultCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-not-interested-result" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const pageState = getObservationsByKind(observations, "page_state")[0] ?? null;
      const runtimeSignal = getObservationsByKind(observations, "runtime_signal")[0] ?? null;
      const screenshotDiff = getObservationsByKind(observations, "screenshot_diff")[0] ?? null;
      const videoAfter = getObservationsByKind(observations, "video_identity").find((observation) => observation.payload.role === "after") ?? null;
      const supportingObservationRefs = [pageState?.ref, runtimeSignal?.ref, screenshotDiff?.ref, videoAfter?.ref].filter((value): value is string => value !== null);
      const supportingSourceProofRefs = [pageState?.source.sourceProofRef, runtimeSignal?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, videoAfter?.source.sourceProofRef].filter((value): value is string => value !== null);
      const changed = pageState?.payload.recommendationChanged
        ?? (screenshotDiff?.payload.changed === true ? true : null)
        ?? (videoAfter?.payload.confirmed === true ? true : null)
        ?? null;

      if (changed === null) {
        return VerifyNotInterestedResultOutputSchema.parse({
          observedOutcome: "recommendation_change_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Not-interested verification requires governed feed mutation evidence.",
          statusMessage: "Recommendation mutation is not observable from the governed evidence.",
          dataQualityFlags: ["recommendation_change_unknown"],
          supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
          supportingObservationRefs,
          supportingSourceProofRefs,
          verifiedByEvidenceKinds: ["page_state", "screenshot_diff", "video_identity"],
          confidenceSource: "feed_mutation_evidence",
        });
      }

      if (pageState?.payload.recommendationChanged !== true && (runtimeSignal?.payload.recommendationChanged ?? null) === true) {
        return VerifyNotInterestedResultOutputSchema.parse({
          observedOutcome: runtimeSignal?.payload.summary ?? "runtime_signal_only",
          verificationDecision: "review_required",
          confidence: 0.3,
          failureReason: "self_reported_success_only",
          reviewRequiredReason: "Runtime signal alone cannot establish a governed not-interested result.",
          statusMessage: "Not-interested verification requires corroborated before/after evidence.",
          dataQualityFlags: ["self_reported_only"],
          supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
          supportingObservationRefs: runtimeSignal ? [runtimeSignal.ref] : [],
          supportingSourceProofRefs: runtimeSignal ? [runtimeSignal.source.sourceProofRef] : [],
          verifiedByEvidenceKinds: ["runtime_signal"],
          confidenceSource: "runtime_signal_only",
        });
      }

      return VerifyNotInterestedResultOutputSchema.parse({
        observedOutcome: changed ? (pageState?.payload.changeSummary ?? runtimeSignal?.payload.summary ?? "recommendation_changed") : "recommendation_unchanged",
        verificationDecision: changed ? "verified" : "failed",
        confidence: changed ? 0.86 : 0.9,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        statusMessage: changed ? "Recommendation feed changed after the not-interested action." : "Recommendation feed did not change after the not-interested action.",
        dataQualityFlags: [],
        supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
        supportingObservationRefs: [pageState?.ref, screenshotDiff?.ref, videoAfter?.ref].filter((value): value is string => value !== null),
        supportingSourceProofRefs: [pageState?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, videoAfter?.source.sourceProofRef].filter((value): value is string => value !== null),
        verifiedByEvidenceKinds: ["page_state", "screenshot_diff", "video_identity"],
        confidenceSource: "feed_mutation_evidence",
      });
    },
  };
}
