import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation, type PostActionVerificationAbilityContext, type PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyCommentsPanelOpenedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyCommentsPanelOpenedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-comments-panel-opened" as const,
    async execute(input: Parameters<PostActionVerificationAbilityContext["evidenceReadPort"]["listObservations"]>[0], context: PostActionVerificationAbilityContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const pageState = getObservationsByKind(observations, "page_state")[0] ?? null;
      const visualTarget = getObservationsByKind(observations, "visual_target")[0] ?? null;
      const overlayConflict = pageState?.payload.modalOverlayPresent === true;
      if (overlayConflict) {
        return VerifyCommentsPanelOpenedOutputSchema.parse({
          observedOutcome: "modal_overlay_present",
          verificationDecision: "review_required",
          confidence: 0.4,
          failureReason: "conflicting_observation",
          reviewRequiredReason: "A modal or overlay is still present after the open-comments action.",
          statusMessage: "Comments panel open verification conflicts with modal overlay evidence.",
          dataQualityFlags: ["modal_overlay_conflict"],
        });
      }

      const isOpen = [
        pageState?.payload.commentsPanelOpen ?? null,
        visualTarget?.payload.commentsPanelOpen ?? null,
        visualTarget?.payload.targetType === "comments_panel" ? true : null,
      ].find((value) => value !== null) ?? null;

      if (isOpen === null) {
        return VerifyCommentsPanelOpenedOutputSchema.parse({
          observedOutcome: "comments_panel_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Comments panel state is not observable from the governed after evidence.",
          statusMessage: "Comments panel open verification requires stronger after evidence.",
          dataQualityFlags: ["comments_state_unknown"],
        });
      }

      return VerifyCommentsPanelOpenedOutputSchema.parse({
        observedOutcome: isOpen ? "comments_panel_open" : "comments_panel_closed",
        verificationDecision: isOpen ? "verified" : "failed",
        confidence: isOpen ? 0.92 : 0.88,
        failureReason: isOpen ? null : "unexpected_state",
        reviewRequiredReason: null,
        statusMessage: isOpen ? "Comments panel opened successfully." : "Comments panel did not open after the click.",
        dataQualityFlags: [],
      });
    },
  };
}
