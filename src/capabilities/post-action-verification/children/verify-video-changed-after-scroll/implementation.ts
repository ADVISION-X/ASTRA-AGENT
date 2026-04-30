import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import { parsePostActionTimestampMs } from "../../runtime/verification-clock.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyVideoChangedAfterScrollOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyVideoChangedAfterScrollCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-video-changed-after-scroll" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const videoIdentityObservations = getObservationsByKind(observations, "video_identity");
      const beforeObservation = videoIdentityObservations.find((observation) => observation.payload.role === "before") ?? null;
      const afterObservation = videoIdentityObservations.find((observation) => observation.payload.role === "after") ?? null;
      if (beforeObservation === null || afterObservation === null) {
        return VerifyVideoChangedAfterScrollOutputSchema.parse({
          observedOutcome: "video_identity_incomplete",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "missing_before_after_evidence",
          reviewRequiredReason: "Video-change verification requires governed before and after identity observations.",
          statusMessage: "Before and after video identity observations are incomplete.",
          dataQualityFlags: ["video_identity_incomplete"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: videoIdentityObservations.map((observation) => observation.ref),
          supportingSourceProofRefs: videoIdentityObservations.map((observation) => observation.source.sourceProofRef),
          verifiedByEvidenceKinds: ["video_identity"],
          confidenceSource: "video_identity_pair",
        });
      }

      if (
        parsePostActionTimestampMs(beforeObservation.capturedAt) >= parsePostActionTimestampMs(input.actionProof.startedAt)
        || parsePostActionTimestampMs(afterObservation.capturedAt) <= parsePostActionTimestampMs(input.actionProof.endedAt)
      ) {
        return VerifyVideoChangedAfterScrollOutputSchema.parse({
          observedOutcome: "video_identity_out_of_window",
          verificationDecision: "review_required",
          confidence: 0.2,
          failureReason: "before_after_conflict",
          reviewRequiredReason: "Video identity observations must straddle the scroll execution window.",
          statusMessage: "Video identity observation timing is not valid for governed scroll verification.",
          dataQualityFlags: ["before_after_conflict"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [beforeObservation.ref, afterObservation.ref],
          supportingSourceProofRefs: [beforeObservation.source.sourceProofRef, afterObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["video_identity"],
          confidenceSource: "video_identity_pair",
        });
      }

      const beforeVideoId = beforeObservation.payload.videoId;
      const afterVideoId = afterObservation.payload.videoId;
      const beforeSignature = beforeObservation.payload.visualSignature;
      const afterSignature = afterObservation.payload.visualSignature;
      const changed = beforeVideoId !== null && afterVideoId !== null
        ? beforeVideoId !== afterVideoId
        : beforeSignature !== null && afterSignature !== null
          ? beforeSignature !== afterSignature
          : null;

      if (changed === null) {
        return VerifyVideoChangedAfterScrollOutputSchema.parse({
          observedOutcome: "video_identity_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Video-change verification could not establish before/after identity.",
          statusMessage: "Video identity evidence is insufficient for scroll verification.",
          dataQualityFlags: ["video_identity_unknown"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [beforeObservation.ref, afterObservation.ref],
          supportingSourceProofRefs: [beforeObservation.source.sourceProofRef, afterObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["video_identity"],
          confidenceSource: "video_identity_pair",
        });
      }

      if (changed && afterObservation.payload.confirmed === false) {
        return VerifyVideoChangedAfterScrollOutputSchema.parse({
          observedOutcome: "video_change_unconfirmed",
          verificationDecision: "review_required",
          confidence: 0.35,
          failureReason: "conflicting_observation",
          reviewRequiredReason: "A new video appeared, but the after observation could not confirm the feed settled on it.",
          statusMessage: "Video-change verification requires a confirmed post-scroll landing state.",
          dataQualityFlags: ["after_unconfirmed"],
          supportingEvidenceRefs: input.beforeAfterEvidence.afterEvidence ? [input.beforeAfterEvidence.afterEvidence.evidenceRef] : [],
          supportingObservationRefs: [beforeObservation.ref, afterObservation.ref],
          supportingSourceProofRefs: [beforeObservation.source.sourceProofRef, afterObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["video_identity"],
          confidenceSource: "video_identity_pair",
        });
      }

      return VerifyVideoChangedAfterScrollOutputSchema.parse({
        observedOutcome: changed ? "video_changed" : "video_unchanged",
        verificationDecision: changed ? "verified" : "failed",
        confidence: changed ? 0.97 : 0.93,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        statusMessage: changed ? "Feed advanced to a different video." : "Feed remained on the same video after scroll.",
        dataQualityFlags: [],
        supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
        supportingObservationRefs: [beforeObservation.ref, afterObservation.ref],
        supportingSourceProofRefs: [beforeObservation.source.sourceProofRef, afterObservation.source.sourceProofRef],
        verifiedByEvidenceKinds: ["video_identity"],
        confidenceSource: "video_identity_pair",
      });
    },
  };
}
