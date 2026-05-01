import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type ParsedPostActionVerificationAbilityInput,
  type PostActionObservation,
} from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyCommentsPanelOpenedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

function buildCommentsPanelOpenedOverlayConflictResult(pageStateRef: string) {
  return VerifyCommentsPanelOpenedOutputSchema.parse({
    observedOutcome: "modal_overlay_present",
    verificationDecision: "review_required",
    confidence: 0.4,
    failureReason: "conflicting_observation",
    reviewRequiredReason: "A modal or overlay is still present after the open-comments action.",
    statusMessage: "Comments panel open verification conflicts with modal overlay evidence.",
    dataQualityFlags: ["modal_overlay_conflict"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateRef],
    supportingSourceProofRefs: [pageStateRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_modal_overlay",
  });
}

function buildCommentsPanelOpenedUnknownResult(alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelOpenedOutputSchema.parse({
    observedOutcome: "comments_panel_unknown",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Comments panel verification requires aligned page-state and visual-target evidence.",
    statusMessage: "Comments panel open verification requires stronger after evidence.",
    dataQualityFlags: ["comments_state_unknown"],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function buildCommentsPanelOpenedConflictResult(alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelOpenedOutputSchema.parse({
    observedOutcome: "comments_panel_conflict",
    verificationDecision: "review_required",
    confidence: 0.3,
    failureReason: "conflicting_observation",
    reviewRequiredReason: "Page-state and visual-target evidence disagree on comments panel state.",
    statusMessage: "Comments panel open verification encountered conflicting after evidence.",
    dataQualityFlags: ["conflicting_observation"],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function buildCommentsPanelOpenedResult(pageStateSignal: boolean, alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelOpenedOutputSchema.parse({
    observedOutcome: pageStateSignal ? "comments_panel_open" : "comments_panel_closed",
    verificationDecision: pageStateSignal ? "verified" : "failed",
    confidence: pageStateSignal ? 0.92 : 0.88,
    failureReason: pageStateSignal ? null : "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: pageStateSignal ? "Comments panel opened successfully." : "Comments panel did not open after the click.",
    dataQualityFlags: [],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function resolveCommentsPanelOpenedResult(input: {
  observations: PostActionObservation[];
  afterEvidenceRef: string | null;
}) {
  const pageState = getObservationsByKind(input.observations, "page_state")[0] ?? null;
  const visualTarget = getObservationsByKind(input.observations, "visual_target")[0] ?? null;
  if (pageState?.payload.modalOverlayPresent === true) {
    return buildCommentsPanelOpenedOverlayConflictResult(pageState.ref);
  }

  const pageStateSignal = pageState?.payload.commentsPanelOpen ?? null;
  const visualSignal = visualTarget?.payload.commentsPanelOpen ?? (visualTarget?.payload.targetType === "comments_panel" ? true : null);
  const alignedObservationRefs = [pageState?.ref, visualTarget?.ref].filter((value): value is string => value !== null);
  const alignedSourceProofRefs = [pageState?.source.sourceProofRef, visualTarget?.source.sourceProofRef].filter((value): value is string => value !== null);

  if (pageStateSignal === null || visualSignal === null) {
    return buildCommentsPanelOpenedUnknownResult(alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
  }

  if (pageStateSignal !== visualSignal) {
    return buildCommentsPanelOpenedConflictResult(alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
  }

  return buildCommentsPanelOpenedResult(pageStateSignal, alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
}

async function executeVerifyCommentsPanelOpened(
  input: ParsedPostActionVerificationAbilityInput,
  context: PostActionVerificationRuntimeContext,
  afterEvidenceRef: string | null,
) {
  return resolveCommentsPanelOpenedResult({ observations: context.evidenceReadPort.listObservations(input), afterEvidenceRef });
}

export function createVerifyCommentsPanelOpenedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-comments-panel-opened" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return executeVerifyCommentsPanelOpened(input, context, input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null);
    },
  };
}
