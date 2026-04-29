import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

function isPointInsideBoundingBox(point: { x: number; y: number }, boundingBox: { x: number; y: number; width: number; height: number }): boolean {
  return point.x > boundingBox.x
    && point.y > boundingBox.y
    && point.x < boundingBox.x + boundingBox.width
    && point.y < boundingBox.y + boundingBox.height;
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
      candidates: VisualTargetCandidate[];
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required" | "blocked";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const screenshot = input.request.sourceProof.screenshot;
  const accepted: VisualTargetCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const flags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.candidates) {
    if (candidate.coordinateSpace === "contact_sheet") {
      rejectedCandidateRefs.push(candidate.candidateRef);
      continue;
    }
    if (!isBoundingBoxInsideImage(candidate, screenshot.imageWidth, screenshot.imageHeight)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_bbox_out_of_bounds");
      continue;
    }
    if (candidate.coordinateSpace === "ai_input") {
      if (!candidate.scaleMapping) {
        rejectedCandidateRefs.push(candidate.candidateRef);
        flags.add("candidate_coordinate_requires_mapping");
        continue;
      }
      if (
        candidate.scaleMapping.sourceWidth !== screenshot.imageWidth
        || candidate.scaleMapping.sourceHeight !== screenshot.imageHeight
      ) {
        rejectedCandidateRefs.push(candidate.candidateRef);
        flags.add("candidate_mapping_unverified");
        continue;
      }
    }
    if (candidate.clickPoint && !isPointInsideBoundingBox(candidate.clickPoint, candidate.boundingBox)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      flags.add("candidate_bbox_out_of_bounds");
      continue;
    }
    accepted.push(candidate);
  }

  if (accepted.length === 0) {
    if (input.candidates.some((candidate) => candidate.coordinateSpace === "contact_sheet")) {
      return {
        ok: false,
        status: "blocked",
        decision: "block",
        failureReason: "contact_sheet_forbidden",
        statusMessage: "Visual Target cannot return success from contact_sheet coordinates.",
        reviewRequiredReason: null,
        rejectedCandidateRefs,
        dataQualityFlags: [...flags],
      };
    }
    if (flags.has("candidate_coordinate_requires_mapping") || flags.has("candidate_mapping_unverified")) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: "ai_input_scale_mapping_missing",
        statusMessage: "Visual Target requires verified scale mapping for ai_input candidates.",
        reviewRequiredReason: "Visual Target cannot accept ai_input coordinates without governed scale mapping.",
        rejectedCandidateRefs,
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
      dataQualityFlags: [...flags],
    };
  }

  return {
    ok: true,
    decision: "allow",
    candidates: accepted,
    rejectedCandidateRefs,
    dataQualityFlags: [...flags],
  };
}