import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import {
  collectVisualTargetFlags,
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

function isPointInsideBoundingBox(point: { x: number; y: number }, boundingBox: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= boundingBox.x
    && point.y >= boundingBox.y
    && point.x <= boundingBox.x + boundingBox.width
    && point.y <= boundingBox.y + boundingBox.height;
}

function isBoundingBoxInsideImage(candidate: VisualTargetCandidate, width: number, height: number): boolean {
  return candidate.boundingBox.x >= 0
    && candidate.boundingBox.y >= 0
    && candidate.boundingBox.width > 0
    && candidate.boundingBox.height > 0
    && candidate.boundingBox.x + candidate.boundingBox.width <= width
    && candidate.boundingBox.y + candidate.boundingBox.height <= height;
}

type CoordinateSpaceAllow = VisualTargetGateSuccess<"allow", {
  candidates: VisualTargetResolvedCandidate[];
  rejectedCandidateRefs: string[];
  coordinateTransformTrace: string[];
}>;

type CoordinateSpaceBlocked = VisualTargetGateBlocked<"block", {
  rejectedCandidateRefs: string[];
  coordinateTransformTrace: string[];
}>;

type CoordinateSpaceReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  rejectedCandidateRefs: string[];
  coordinateTransformTrace: string[];
}>;

type CoordinateCandidateInspection = {
  acceptedCandidate: VisualTargetResolvedCandidate | null;
  rejectedCandidateRef: string | null;
  dataQualityFlag: VisualTargetDataQualityFlag | null;
  coordinateTrace: string | null;
};

type ExecutableCandidateShape = {
  executableCoordinateSpace: VisualTargetCandidate["coordinateSpace"];
  executableBoundingBox: VisualTargetCandidate["boundingBox"];
  executableClickPoint: VisualTargetCandidate["clickPoint"];
  coordinateTrace: string | null;
};

function rejectCoordinateCandidate(candidateRef: string, dataQualityFlag: VisualTargetDataQualityFlag): CoordinateCandidateInspection {
  return { acceptedCandidate: null, rejectedCandidateRef: candidateRef, dataQualityFlag, coordinateTrace: null };
}

function hasVerifiedScaleMapping(input: {
  candidate: VisualTargetCandidate;
  screenshot: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
}): boolean {
  if (!input.candidate.scaleMapping) {
    return false;
  }
  const expectedScaleX = input.candidate.scaleMapping.sourceWidth / input.candidate.scaleMapping.targetWidth;
  const expectedScaleY = input.candidate.scaleMapping.sourceHeight / input.candidate.scaleMapping.targetHeight;
  return input.candidate.scaleMapping.sourceScreenshotEvidenceId === input.screenshot.screenshotEvidenceId
    && input.candidate.scaleMapping.targetCoordinateSpace === "ai_input"
    && Math.abs(input.candidate.scaleMapping.scaleX - expectedScaleX) <= 0.0001
    && Math.abs(input.candidate.scaleMapping.scaleY - expectedScaleY) <= 0.0001;
}

function mapExecutableBoundingBox(candidate: VisualTargetCandidate): VisualTargetCandidate["boundingBox"] {
  return {
    x: candidate.boundingBox.x * candidate.scaleMapping!.scaleX + candidate.scaleMapping!.cropOffsetX,
    y: candidate.boundingBox.y * candidate.scaleMapping!.scaleY + candidate.scaleMapping!.cropOffsetY,
    width: candidate.boundingBox.width * candidate.scaleMapping!.scaleX,
    height: candidate.boundingBox.height * candidate.scaleMapping!.scaleY,
  };
}

function mapExecutableClickPoint(candidate: VisualTargetCandidate): VisualTargetCandidate["clickPoint"] {
  return candidate.clickPoint
    ? {
        x: candidate.clickPoint.x * candidate.scaleMapping!.scaleX + candidate.scaleMapping!.cropOffsetX,
        y: candidate.clickPoint.y * candidate.scaleMapping!.scaleY + candidate.scaleMapping!.cropOffsetY,
      }
    : null;
}

function resolveAiInputCandidateShape(input: {
  candidate: VisualTargetCandidate;
  screenshot: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
}): ExecutableCandidateShape | CoordinateCandidateInspection {
  if (!input.candidate.scaleMapping) {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_coordinate_requires_mapping");
  }
  if (!hasVerifiedScaleMapping(input)) {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_mapping_unverified");
  }
  return {
    executableCoordinateSpace: input.candidate.scaleMapping.sourceCoordinateSpace,
    executableBoundingBox: mapExecutableBoundingBox(input.candidate),
    executableClickPoint: mapExecutableClickPoint(input.candidate),
    coordinateTrace: `candidate ${input.candidate.candidateRef} mapped from ai_input to ${input.candidate.scaleMapping.sourceCoordinateSpace}`,
  };
}

function resolveExecutableCandidateShape(input: {
  candidate: VisualTargetCandidate;
  screenshot: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
}):
  | ExecutableCandidateShape
  | CoordinateCandidateInspection {
  const { candidate, screenshot } = input;
  if (candidate.coordinateSpace === "contact_sheet") {
    return rejectCoordinateCandidate(candidate.candidateRef, "candidate_coordinate_non_executable");
  }
  if (candidate.coordinateSpace !== "ai_input") {
    return {
      executableCoordinateSpace: candidate.coordinateSpace,
      executableBoundingBox: candidate.boundingBox,
      executableClickPoint: candidate.clickPoint,
      coordinateTrace: null,
    };
  }

  const executableShape = resolveAiInputCandidateShape({ candidate, screenshot });
  if ("acceptedCandidate" in executableShape) {
    return executableShape;
  }
  return executableShape.executableCoordinateSpace === "ai_input"
    ? rejectCoordinateCandidate(candidate.candidateRef, "candidate_coordinate_non_executable")
    : executableShape;
}

function inspectCoordinateCandidate(input: {
  candidate: VisualTargetCandidate;
  screenshot: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
}): CoordinateCandidateInspection {
  if (!isBoundingBoxInsideImage(input.candidate, input.screenshot.imageWidth, input.screenshot.imageHeight)) {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_bbox_out_of_bounds");
  }

  const executableShape = resolveExecutableCandidateShape(input);
  if ("acceptedCandidate" in executableShape) {
    return executableShape;
  }
  if (executableShape.executableCoordinateSpace === "contact_sheet" || executableShape.executableCoordinateSpace === "ai_input") {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_coordinate_non_executable");
  }

  const acceptedCandidate: VisualTargetResolvedCandidate = {
    ...input.candidate,
    originalCoordinateSpace: input.candidate.coordinateSpace,
    executableCoordinateSpace: executableShape.executableCoordinateSpace,
    executableBoundingBox: executableShape.executableBoundingBox,
    executableClickPoint: executableShape.executableClickPoint,
    geometryScaleMapping: input.candidate.scaleMapping,
  };

  if (!isBoundingBoxInsideImage({ ...input.candidate, boundingBox: acceptedCandidate.executableBoundingBox }, input.screenshot.imageWidth, input.screenshot.imageHeight)) {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_bbox_out_of_bounds");
  }
  if (acceptedCandidate.executableClickPoint && !isPointInsideBoundingBox(acceptedCandidate.executableClickPoint, acceptedCandidate.executableBoundingBox)) {
    return rejectCoordinateCandidate(input.candidate.candidateRef, "candidate_bbox_out_of_bounds");
  }

  return {
    acceptedCandidate,
    rejectedCandidateRef: null,
    dataQualityFlag: null,
    coordinateTrace: executableShape.coordinateTrace,
  };
}

function createCoordinateSpaceFailure(input: {
  candidates: VisualTargetCandidate[];
  rejectedCandidateRefs: string[];
  coordinateTransformTrace: string[];
  dataQualityFlags: Set<VisualTargetDataQualityFlag>;
}): CoordinateSpaceBlocked | CoordinateSpaceReviewRequired {
  const flags = collectVisualTargetFlags(input.dataQualityFlags);
  if (input.candidates.some((candidate) => candidate.coordinateSpace === "contact_sheet")) {
    return createVisualTargetGateBlocked({
      decision: "block",
      failureReason: "contact_sheet_forbidden",
      statusMessage: "Visual Target cannot return success from contact_sheet coordinates.",
      dataQualityFlags: flags,
      extra: { rejectedCandidateRefs: input.rejectedCandidateRefs, coordinateTransformTrace: input.coordinateTransformTrace },
    });
  }
  if (
    input.dataQualityFlags.has("candidate_coordinate_requires_mapping")
    || input.dataQualityFlags.has("candidate_mapping_unverified")
    || input.dataQualityFlags.has("candidate_coordinate_non_executable")
  ) {
    const failureReason = input.dataQualityFlags.has("candidate_mapping_unverified")
      ? "invalid_scale_mapping"
      : input.dataQualityFlags.has("candidate_coordinate_non_executable")
        ? "ai_input_coordinate_non_executable"
        : "ai_input_scale_mapping_missing";
    return createVisualTargetGateReviewRequired({
      decision: "review_required",
      failureReason,
      statusMessage: "Visual Target requires verified executable coordinate mapping before success.",
      reviewRequiredReason: "Visual Target cannot accept non-executable coordinates for governed success.",
      dataQualityFlags: flags,
      extra: { rejectedCandidateRefs: input.rejectedCandidateRefs, coordinateTransformTrace: input.coordinateTransformTrace },
    });
  }
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason: "bbox_out_of_bounds",
    statusMessage: "Visual Target rejected every candidate because coordinates exceed screenshot bounds.",
    dataQualityFlags: flags,
    extra: { rejectedCandidateRefs: input.rejectedCandidateRefs, coordinateTransformTrace: input.coordinateTransformTrace },
  });
}

export function validateCoordinateSpace(input: {
  request: ParsedVisualTargetAbilityInput;
  candidates: VisualTargetCandidate[];
}): CoordinateSpaceAllow | CoordinateSpaceBlocked | CoordinateSpaceReviewRequired {
  const screenshot = input.request.sourceProof.screenshot;
  const accepted: VisualTargetResolvedCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const coordinateTransformTrace: string[] = [];
  const flags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.candidates) {
    const inspection = inspectCoordinateCandidate({ candidate, screenshot });
    if (inspection.rejectedCandidateRef) {
      rejectedCandidateRefs.push(inspection.rejectedCandidateRef);
    }
    if (inspection.dataQualityFlag) {
      flags.add(inspection.dataQualityFlag);
    }
    if (inspection.coordinateTrace) {
      coordinateTransformTrace.push(inspection.coordinateTrace);
    }
    if (inspection.acceptedCandidate) {
      accepted.push(inspection.acceptedCandidate);
    }
  }

  if (accepted.length === 0) {
    return createCoordinateSpaceFailure({
      candidates: input.candidates,
      rejectedCandidateRefs,
      coordinateTransformTrace,
      dataQualityFlags: flags,
    });
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(flags), {
    candidates: accepted,
    rejectedCandidateRefs,
    coordinateTransformTrace,
  });
}