import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation, type PostActionVerificationAbilityContext, type PostActionVerificationChildCapability } from "../../contract.js";
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
    async execute(input: Parameters<PostActionVerificationAbilityContext["evidenceReadPort"]["listObservations"]>[0], context: PostActionVerificationAbilityContext) {
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
      });
    },
  };
}
