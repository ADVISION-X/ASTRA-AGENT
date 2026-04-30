import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

export function validateGeometryProof(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
}):
  | { ok: true; geometryDecision: "allow"; geometryDecisionReason: "geometry_proof_bound" }
  | {
      ok: false;
      status: "failed";
      failureReason: "missing_geometry_guard_proof" | "geometry_guard_not_allowed" | "geometry_proof_mismatch" | "geometry_proof_missing_coordinate" | "geometry_proof_missing_source_ref" | "unsupported_coordinate_space" | "geometry_guard_ref_missing";
      reviewRequiredReason: null;
      statusMessage: string;
      geometryDecision: "block";
      geometryDecisionReason: string;
      dataQualityFlags: string[];
    } {
  const proof = input.request.geometryGuardProof;
  if (!proof) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_geometry_guard_proof",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires geometryGuardProof before any primitive execution.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_guard_proof_missing",
      dataQualityFlags: ["geometry_guard_proof_missing"],
    };
  }
  if (!proof.geometryGuardRef.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_guard_ref_missing",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires geometryGuardRef before any primitive execution.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_guard_ref_missing",
      dataQualityFlags: ["geometry_guard_ref_missing"],
    };
  }
  if (proof.normalizedCoordinateSpace !== input.expectedCoordinateSpace) {
    return {
      ok: false,
      status: "failed",
      failureReason: "unsupported_coordinate_space",
      reviewRequiredReason: null,
      statusMessage: `Mouse Click child ${input.request.childCapabilityId} only accepts ${input.expectedCoordinateSpace} executable coordinates.`,
      geometryDecision: "block",
      geometryDecisionReason: "geometry_coordinate_space_mismatch",
      dataQualityFlags: ["geometry_coordinate_space_mismatch"],
    };
  }
  if (proof.normalizedClickPoint === null) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_coordinate",
      reviewRequiredReason: null,
      statusMessage: "Geometry Guard proof must include normalizedClickPoint.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_coordinate_missing",
      dataQualityFlags: ["geometry_coordinate_missing"],
    };
  }
  if (!proof.sourceScreenshotEvidenceRef && !proof.sourceTargetRef) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_source_ref",
      reviewRequiredReason: null,
      statusMessage: "Geometry Guard proof must carry sourceScreenshotEvidenceRef or sourceTargetRef.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_source_ref_missing",
      dataQualityFlags: ["geometry_source_ref_missing"],
    };
  }
  if (input.request.sourceCoordinateProofRef !== proof.proofId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "sourceCoordinateProofRef must match geometryGuardProof.proofId.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_proof_ref_mismatch",
      dataQualityFlags: ["geometry_proof_ref_mismatch"],
    };
  }
  if (input.request.sourceTargetRef !== proof.sourceTargetRef) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "sourceTargetRef must bind to the same target as geometryGuardProof.sourceTargetRef.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_target_ref_mismatch",
      dataQualityFlags: ["geometry_target_ref_mismatch"],
    };
  }
  if (input.request.sessionId !== proof.sessionId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click sessionId must match geometryGuardProof.sessionId.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_session_mismatch",
      dataQualityFlags: ["geometry_session_mismatch"],
    };
  }
  if (input.request.roundId && proof.roundId && input.request.roundId !== proof.roundId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click roundId conflicts with geometryGuardProof.roundId.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_round_mismatch",
      dataQualityFlags: ["geometry_round_mismatch"],
    };
  }
  if (input.request.videoVisitId && proof.videoVisitId && input.request.videoVisitId !== proof.videoVisitId) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_mismatch",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click videoVisitId conflicts with geometryGuardProof.videoVisitId.",
      geometryDecision: "block",
      geometryDecisionReason: "geometry_video_visit_mismatch",
      dataQualityFlags: ["geometry_video_visit_mismatch"],
    };
  }
  return { ok: true, geometryDecision: "allow", geometryDecisionReason: "geometry_proof_bound" };
}