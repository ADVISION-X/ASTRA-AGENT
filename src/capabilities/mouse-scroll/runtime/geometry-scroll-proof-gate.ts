import type { MouseScrollCoordinateSpace, ParsedMouseScrollAbilityInput } from "../contract.js";

type GeometryScrollFailureReason =
  | "missing_geometry_scroll_proof"
  | "geometry_guard_not_allowed"
  | "geometry_proof_mismatch"
  | "geometry_proof_missing_anchor"
  | "geometry_proof_missing_region"
  | "geometry_proof_missing_source_ref"
  | "invalid_coordinate_space";

type GeometryScrollFailure = {
  ok: false;
  status: "failed";
  failureReason: GeometryScrollFailureReason;
  reviewRequiredReason: null;
  statusMessage: string;
  geometryDecision: "block";
  geometryDecisionReason: string;
  dataQualityFlags: string[];
};

const createGeometryScrollFailure = (input: {
  failureReason: GeometryScrollFailureReason;
  statusMessage: string;
  geometryDecisionReason: string;
  dataQualityFlags: string[];
}): GeometryScrollFailure => ({
  ok: false,
  status: "failed",
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  statusMessage: input.statusMessage,
  geometryDecision: "block",
  geometryDecisionReason: input.geometryDecisionReason,
  dataQualityFlags: input.dataQualityFlags,
});

const validateProofPresence = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  return request.geometryScrollProof
    ? null
    : createGeometryScrollFailure({
        failureReason: "missing_geometry_scroll_proof",
        statusMessage: "Mouse Scroll requires geometryScrollProof before any primitive execution.",
        geometryDecisionReason: "geometry_scroll_proof_missing",
        dataQualityFlags: ["geometry_scroll_proof_missing"],
      });
};

const validateGuardDecision = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }

  return proof.abilityGroupId === "geometry-guard" && proof.status === "success" && proof.guardDecision === "allow"
    ? null
    : createGeometryScrollFailure({
        failureReason: "geometry_guard_not_allowed",
        statusMessage: "Mouse Scroll requires Geometry Guard success + allow proof.",
        geometryDecisionReason: "geometry_guard_not_allowed",
        dataQualityFlags: ["geometry_guard_not_allowed"],
      });
};

const validateCoordinateSpace = (
  request: ParsedMouseScrollAbilityInput,
  expectedCoordinateSpace: MouseScrollCoordinateSpace,
): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }

  return proof.normalizedCoordinateSpace === expectedCoordinateSpace && request.coordinateSpace === expectedCoordinateSpace
    ? null
    : createGeometryScrollFailure({
        failureReason: "invalid_coordinate_space",
        statusMessage: `Mouse Scroll child ${request.childCapabilityId} only accepts ${expectedCoordinateSpace} executable coordinates.`,
        geometryDecisionReason: "geometry_coordinate_space_mismatch",
        dataQualityFlags: ["geometry_coordinate_space_mismatch"],
      });
};

const validateAnchorAndRegion = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }
  if (proof.normalizedAnchorPoint === null) {
    return createGeometryScrollFailure({
      failureReason: "geometry_proof_missing_anchor",
      statusMessage: "Geometry Scroll proof must include normalizedAnchorPoint.",
      geometryDecisionReason: "geometry_anchor_missing",
      dataQualityFlags: ["geometry_anchor_missing"],
    });
  }

  return request.childCapabilityId === "scroll-region" && proof.normalizedRegion === null
    ? createGeometryScrollFailure({
        failureReason: "geometry_proof_missing_region",
        statusMessage: "scroll-region requires Geometry Guard normalizedRegion proof.",
        geometryDecisionReason: "geometry_region_missing",
        dataQualityFlags: ["geometry_region_missing"],
      })
    : null;
};

const validateSourceBindings = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }
  if (!proof.sourceScreenshotEvidenceRef && !request.sourceEvidenceRef) {
    return createGeometryScrollFailure({
      failureReason: "geometry_proof_missing_source_ref",
      statusMessage: "Geometry Scroll proof must carry sourceScreenshotEvidenceRef or the request must carry sourceEvidenceRef.",
      geometryDecisionReason: "geometry_source_ref_missing",
      dataQualityFlags: ["geometry_source_ref_missing"],
    });
  }
  if (request.sourceCoordinateProofRef !== proof.proofId) {
    return createGeometryScrollFailure({
      failureReason: "geometry_proof_mismatch",
      statusMessage: "sourceCoordinateProofRef must match geometryScrollProof.proofId.",
      geometryDecisionReason: "geometry_proof_ref_mismatch",
      dataQualityFlags: ["geometry_proof_ref_mismatch"],
    });
  }

  return proof.sourceTargetRef && request.sourceTargetRef !== proof.sourceTargetRef
    ? createGeometryScrollFailure({
        failureReason: "geometry_proof_mismatch",
        statusMessage: "sourceTargetRef must bind to the same target as geometryScrollProof.sourceTargetRef.",
        geometryDecisionReason: "geometry_target_ref_mismatch",
        dataQualityFlags: ["geometry_target_ref_mismatch"],
      })
    : null;
};

const validateSessionIdBinding = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }
  if (request.sessionId !== proof.sessionId) {
    return createGeometryScrollFailure({
      failureReason: "geometry_proof_mismatch",
      statusMessage: "Mouse Scroll sessionId must match geometryScrollProof.sessionId.",
      geometryDecisionReason: "geometry_session_mismatch",
      dataQualityFlags: ["geometry_session_mismatch"],
    });
  }

  return null;
};

const validateTimelineBindings = (request: ParsedMouseScrollAbilityInput): GeometryScrollFailure | null => {
  const proof = request.geometryScrollProof;
  if (!proof) {
    return null;
  }
  if (request.roundId && proof.roundId && request.roundId !== proof.roundId) {
    return createGeometryScrollFailure({
      failureReason: "geometry_proof_mismatch",
      statusMessage: "Mouse Scroll roundId conflicts with geometryScrollProof.roundId.",
      geometryDecisionReason: "geometry_round_mismatch",
      dataQualityFlags: ["geometry_round_mismatch"],
    });
  }

  return request.videoVisitId && proof.videoVisitId && request.videoVisitId !== proof.videoVisitId
    ? createGeometryScrollFailure({
        failureReason: "geometry_proof_mismatch",
        statusMessage: "Mouse Scroll videoVisitId conflicts with geometryScrollProof.videoVisitId.",
        geometryDecisionReason: "geometry_video_visit_mismatch",
        dataQualityFlags: ["geometry_video_visit_mismatch"],
      })
    : null;
};

export function validateGeometryScrollProof(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
}):
  | { ok: true; geometryDecision: "allow"; geometryDecisionReason: string }
  | GeometryScrollFailure {
  const failure = validateProofPresence(input.request)
    ?? validateGuardDecision(input.request)
    ?? validateCoordinateSpace(input.request, input.expectedCoordinateSpace)
    ?? validateAnchorAndRegion(input.request)
    ?? validateSourceBindings(input.request)
    ?? validateSessionIdBinding(input.request)
    ?? validateTimelineBindings(input.request);
  if (failure) {
    return failure;
  }

  return { ok: true, geometryDecision: "allow", geometryDecisionReason: "geometry_proof_bound" };
}