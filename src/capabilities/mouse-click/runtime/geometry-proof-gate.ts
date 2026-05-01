import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

type GeometryFailureReason = "missing_geometry_guard_proof" | "geometry_guard_not_allowed" | "geometry_proof_mismatch" | "geometry_proof_missing_coordinate" | "geometry_proof_missing_source_ref" | "unsupported_coordinate_space" | "geometry_guard_ref_missing";

type GeometryFailure = {
  ok: false;
  status: "failed";
  failureReason: GeometryFailureReason;
  reviewRequiredReason: null;
  statusMessage: string;
  geometryDecision: "block";
  geometryDecisionReason: string;
  dataQualityFlags: string[];
};

const createGeometryFailure = (input: {
  failureReason: GeometryFailureReason;
  statusMessage: string;
  geometryDecisionReason: string;
  dataQualityFlags: string[];
}): GeometryFailure => ({
  ok: false,
  status: "failed",
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  statusMessage: input.statusMessage,
  geometryDecision: "block",
  geometryDecisionReason: input.geometryDecisionReason,
  dataQualityFlags: input.dataQualityFlags,
});

const validateProofPresence = (request: ParsedMouseClickAbilityInput): GeometryFailure | null => {
  if (!request.geometryGuardProof) {
    return createGeometryFailure({ failureReason: "missing_geometry_guard_proof", statusMessage: "Mouse Click requires geometryGuardProof before any primitive execution.", geometryDecisionReason: "geometry_guard_proof_missing", dataQualityFlags: ["geometry_guard_proof_missing"] });
  }
  return !request.geometryGuardProof.geometryGuardRef.trim()
    ? createGeometryFailure({ failureReason: "geometry_guard_ref_missing", statusMessage: "Mouse Click requires geometryGuardRef before any primitive execution.", geometryDecisionReason: "geometry_guard_ref_missing", dataQualityFlags: ["geometry_guard_ref_missing"] })
    : null;
};

const validateProofCoordinate = (request: ParsedMouseClickAbilityInput, expectedCoordinateSpace: MouseClickCoordinateSpace): GeometryFailure | null => {
  const proof = request.geometryGuardProof;
  if (!proof) {
    return null;
  }
  if (proof.normalizedCoordinateSpace !== expectedCoordinateSpace) {
    return createGeometryFailure({ failureReason: "unsupported_coordinate_space", statusMessage: `Mouse Click child ${request.childCapabilityId} only accepts ${expectedCoordinateSpace} executable coordinates.`, geometryDecisionReason: "geometry_coordinate_space_mismatch", dataQualityFlags: ["geometry_coordinate_space_mismatch"] });
  }
  return proof.normalizedClickPoint === null
    ? createGeometryFailure({ failureReason: "geometry_proof_missing_coordinate", statusMessage: "Geometry Guard proof must include normalizedClickPoint.", geometryDecisionReason: "geometry_coordinate_missing", dataQualityFlags: ["geometry_coordinate_missing"] })
    : null;
};

const validateProofBindings = (request: ParsedMouseClickAbilityInput): GeometryFailure | null => {
  const proof = request.geometryGuardProof;
  if (!proof) {
    return null;
  }
  if (!proof.sourceScreenshotEvidenceRef && !proof.sourceTargetRef) {
    return createGeometryFailure({ failureReason: "geometry_proof_missing_source_ref", statusMessage: "Geometry Guard proof must carry sourceScreenshotEvidenceRef or sourceTargetRef.", geometryDecisionReason: "geometry_source_ref_missing", dataQualityFlags: ["geometry_source_ref_missing"] });
  }
  if (request.sourceCoordinateProofRef !== proof.proofId) {
    return createGeometryFailure({ failureReason: "geometry_proof_mismatch", statusMessage: "sourceCoordinateProofRef must match geometryGuardProof.proofId.", geometryDecisionReason: "geometry_proof_ref_mismatch", dataQualityFlags: ["geometry_proof_ref_mismatch"] });
  }
  return request.sourceTargetRef !== proof.sourceTargetRef
    ? createGeometryFailure({ failureReason: "geometry_proof_mismatch", statusMessage: "sourceTargetRef must bind to the same target as geometryGuardProof.sourceTargetRef.", geometryDecisionReason: "geometry_target_ref_mismatch", dataQualityFlags: ["geometry_target_ref_mismatch"] })
    : null;
};

const validateProofTimeline = (request: ParsedMouseClickAbilityInput, proofRoundId: string | null, proofVideoVisitId: string | null): GeometryFailure | null => {
  if (request.roundId && proofRoundId && request.roundId !== proofRoundId) {
    return createGeometryFailure({ failureReason: "geometry_proof_mismatch", statusMessage: "Mouse Click roundId conflicts with geometryGuardProof.roundId.", geometryDecisionReason: "geometry_round_mismatch", dataQualityFlags: ["geometry_round_mismatch"] });
  }
  return request.videoVisitId && proofVideoVisitId && request.videoVisitId !== proofVideoVisitId
    ? createGeometryFailure({ failureReason: "geometry_proof_mismatch", statusMessage: "Mouse Click videoVisitId conflicts with geometryGuardProof.videoVisitId.", geometryDecisionReason: "geometry_video_visit_mismatch", dataQualityFlags: ["geometry_video_visit_mismatch"] })
    : null;
};

const validateProofSession = (request: ParsedMouseClickAbilityInput): GeometryFailure | null => {
  const proof = request.geometryGuardProof;
  if (!proof) {
    return null;
  }
  if (request.sessionId !== proof.sessionId) {
    return createGeometryFailure({ failureReason: "geometry_proof_mismatch", statusMessage: "Mouse Click sessionId must match geometryGuardProof.sessionId.", geometryDecisionReason: "geometry_session_mismatch", dataQualityFlags: ["geometry_session_mismatch"] });
  }
  return validateProofTimeline(request, proof.roundId, proof.videoVisitId);
};

export function validateGeometryProof(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
}):
  | { ok: true; geometryDecision: "allow"; geometryDecisionReason: "geometry_proof_bound" }
  | GeometryFailure {
  const failure = validateProofPresence(input.request)
    ?? validateProofCoordinate(input.request, input.expectedCoordinateSpace)
    ?? validateProofBindings(input.request)
    ?? validateProofSession(input.request);
  if (failure) {
    return failure;
  }
  return { ok: true, geometryDecision: "allow", geometryDecisionReason: "geometry_proof_bound" };
}
