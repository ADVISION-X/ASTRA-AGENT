import type { MouseScrollCoordinateSpace, ParsedMouseScrollAbilityInput } from "../contract.js";

export function validateGeometryScrollProof(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
}):
  | { ok: true }
  | {
      ok: false;
      status: "failed" | "review_required";
      failureReason:
        | "missing_geometry_scroll_proof"
        | "geometry_guard_not_allowed"
        | "geometry_proof_mismatch"
        | "geometry_proof_missing_anchor"
        | "geometry_proof_missing_region"
        | "geometry_proof_missing_source_ref"
        | "invalid_coordinate_space";
      reviewRequiredReason: string | null;
      statusMessage: string;
      geometryDecision: "block" | "review_required";
      dataQualityFlags: string[];
    } {
  const proof = input.request.geometryScrollProof;
  if (!proof) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_geometry_scroll_proof",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires geometryScrollProof before any primitive execution.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_scroll_proof_missing"],
    };
  }
  if (proof.abilityGroupId !== "geometry-guard" || proof.status !== "success" || proof.guardDecision !== "allow") {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_guard_not_allowed",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires Geometry Guard success + allow proof.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_guard_not_allowed"],
    };
  }
  if (proof.normalizedCoordinateSpace !== input.expectedCoordinateSpace || input.request.coordinateSpace !== input.expectedCoordinateSpace) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_coordinate_space",
      reviewRequiredReason: null,
      statusMessage: `Mouse Scroll child ${input.request.childCapabilityId} only accepts ${input.expectedCoordinateSpace} executable coordinates.`,
      geometryDecision: "block",
      dataQualityFlags: ["geometry_coordinate_space_mismatch"],
    };
  }
  if (proof.normalizedAnchorPoint === null) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_anchor",
      reviewRequiredReason: null,
      statusMessage: "Geometry Scroll proof must include normalizedAnchorPoint.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_anchor_missing"],
    };
  }
  if (input.request.childCapabilityId === "scroll-region" && proof.normalizedRegion === null) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_region",
      reviewRequiredReason: null,
      statusMessage: "scroll-region requires Geometry Guard normalizedRegion proof.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_region_missing"],
    };
  }
  if (!proof.sourceScreenshotEvidenceRef && !proof.sourceTargetRef) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_source_ref",
      reviewRequiredReason: null,
      statusMessage: "Geometry Scroll proof must carry sourceScreenshotEvidenceRef or sourceTargetRef.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_source_ref_missing"],
    };
  }
  if (input.request.sourceCoordinateProofRef !== proof.proofId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "sourceCoordinateProofRef must match geometryScrollProof.proofId.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_proof_ref_mismatch"],
    };
  }
  if (proof.sourceTargetRef && input.request.sourceTargetRef !== proof.sourceTargetRef) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "sourceTargetRef must bind to the same target as geometryScrollProof.sourceTargetRef.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_target_ref_mismatch"],
    };
  }
  if (input.request.sessionId !== proof.sessionId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll sessionId must match geometryScrollProof.sessionId.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_session_mismatch"],
    };
  }
  if (input.request.roundId && proof.roundId && input.request.roundId !== proof.roundId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll roundId conflicts with geometryScrollProof.roundId.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_round_mismatch"],
    };
  }
  if (input.request.videoVisitId && proof.videoVisitId && input.request.videoVisitId !== proof.videoVisitId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll videoVisitId conflicts with geometryScrollProof.videoVisitId.",
      geometryDecision: "block",
      dataQualityFlags: ["geometry_video_visit_mismatch"],
    };
  }
  return { ok: true };
}