import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";

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

export function validateCoordinateSpace(input: {
  request: ParsedVisualTargetAbilityInput;
  candidates: VisualTargetCandidate[];
}):
  | {
      ok: true;
      decision: "allow";
      candidates: VisualTargetResolvedCandidate[];
      rejectedCandidateRefs: string[];
      coordinateTransformTrace: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      rejectedCandidateRefs: string[];
      coordinateTransformTrace: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const screenshot = input.request.sourceProof.screenshot;
  const accepted: VisualTargetResolvedCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const coordinateTransformTrace: string[] = [];
  const flags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.candidates) {
    if (candidate.coordinateSpace === "contact_sheet") {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_coordinate_non_executable");
      continue;
    }
    if (!isBoundingBoxInsideImage(candidate, screenshot.imageWidth, screenshot.imageHeight)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_bbox_out_of_bounds");
      continue;
    }
    let executableCoordinateSpace = candidate.coordinateSpace;
    let executableBoundingBox = candidate.boundingBox;
    let executableClickPoint = candidate.clickPoint;

    if (candidate.coordinateSpace === "ai_input") {
      if (!candidate.scaleMapping) {
        rejectedCandidateRefs.push(candidate.candidateRef);
        flags.add("candidate_coordinate_requires_mapping");
        continue;
      }
      const expectedScaleX = candidate.scaleMapping.sourceWidth / candidate.scaleMapping.targetWidth;
      const expectedScaleY = candidate.scaleMapping.sourceHeight / candidate.scaleMapping.targetHeight;
      if (
        candidate.scaleMapping.sourceScreenshotEvidenceId !== screenshot.screenshotEvidenceId
        || candidate.scaleMapping.targetCoordinateSpace !== "ai_input"
        || Math.abs(candidate.scaleMapping.scaleX - expectedScaleX) > 0.0001
        || Math.abs(candidate.scaleMapping.scaleY - expectedScaleY) > 0.0001
      ) {
        rejectedCandidateRefs.push(candidate.candidateRef);
        flags.add("candidate_mapping_unverified");
        continue;
      }

      executableCoordinateSpace = candidate.scaleMapping.sourceCoordinateSpace;
      executableBoundingBox = {
        x: candidate.boundingBox.x * candidate.scaleMapping.scaleX + candidate.scaleMapping.cropOffsetX,
        y: candidate.boundingBox.y * candidate.scaleMapping.scaleY + candidate.scaleMapping.cropOffsetY,
        width: candidate.boundingBox.width * candidate.scaleMapping.scaleX,
        height: candidate.boundingBox.height * candidate.scaleMapping.scaleY,
      };
      executableClickPoint = candidate.clickPoint
        ? {
            x: candidate.clickPoint.x * candidate.scaleMapping.scaleX + candidate.scaleMapping.cropOffsetX,
            y: candidate.clickPoint.y * candidate.scaleMapping.scaleY + candidate.scaleMapping.cropOffsetY,
          }
        : null;
      coordinateTransformTrace.push(`candidate ${candidate.candidateRef} mapped from ai_input to ${executableCoordinateSpace}`);
    }

    if (executableCoordinateSpace === "ai_input") {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_coordinate_non_executable");
      continue;
    }

    const resolvedCandidate: VisualTargetResolvedCandidate = {
      ...candidate,
      originalCoordinateSpace: candidate.coordinateSpace,
      executableCoordinateSpace,
      executableBoundingBox,
      executableClickPoint,
      geometryScaleMapping: candidate.scaleMapping,
    };
    if (!isBoundingBoxInsideImage({ ...candidate, boundingBox: executableBoundingBox }, screenshot.imageWidth, screenshot.imageHeight)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_bbox_out_of_bounds");
      continue;
    }
    if (resolvedCandidate.executableClickPoint && !isPointInsideBoundingBox(resolvedCandidate.executableClickPoint, resolvedCandidate.executableBoundingBox)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_bbox_out_of_bounds");
      continue;
    }
    accepted.push(resolvedCandidate);
  }

  if (accepted.length === 0) {
    if (input.candidates.some((candidate) => candidate.coordinateSpace === "contact_sheet")) {
      return {
        ok: false,
        status: "failed",
        decision: "block",
        failureReason: "contact_sheet_forbidden",
        statusMessage: "Visual Target cannot return success from contact_sheet coordinates.",
        reviewRequiredReason: null,
        rejectedCandidateRefs,
        coordinateTransformTrace,
        dataQualityFlags: [...flags],
      };
    }
    if (flags.has("candidate_coordinate_requires_mapping") || flags.has("candidate_mapping_unverified") || flags.has("candidate_coordinate_non_executable")) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: flags.has("candidate_mapping_unverified") ? "invalid_scale_mapping" : flags.has("candidate_coordinate_non_executable") ? "ai_input_coordinate_non_executable" : "ai_input_scale_mapping_missing",
        statusMessage: "Visual Target requires verified executable coordinate mapping before success.",
        reviewRequiredReason: "Visual Target cannot accept non-executable coordinates for governed success.",
        rejectedCandidateRefs,
        coordinateTransformTrace,
        dataQualityFlags: [...flags],
      };
    }
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "bbox_out_of_bounds",
      statusMessage: "Visual Target rejected every candidate because coordinates exceed screenshot bounds.",
      reviewRequiredReason: null,
      rejectedCandidateRefs,
      coordinateTransformTrace,
      dataQualityFlags: [...flags],
    };
  }

  return {
    ok: true,
    decision: "allow",
    candidates: accepted,
    rejectedCandidateRefs,
    coordinateTransformTrace,
    dataQualityFlags: [...flags],
  };
}