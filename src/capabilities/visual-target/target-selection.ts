import type {
  VisualBoundingBox,
  VisualClickPoint,
  VisualTargetCandidate,
  VisualTargetCoordinateSpace,
  VisualTargetDataQualityPolicy,
  VisualTargetFailureReason,
  VisualTargetSelectionPolicy,
} from "./contract.js";
import type { VisualTargetConfidencePolicy } from "./contract.js";
import { createDefaultClickPoint, isPointInsideBoundingBox } from "./shared/target-validation.js";

type NormalizedCandidate = {
  sourceCandidateRef: string | null;
  sourceAiResultRef: string | null;
  coordinateSpace: VisualTargetCoordinateSpace;
  boundingBox: VisualBoundingBox;
  clickPoint: VisualClickPoint;
  confidence: number;
  detectionMethod: string;
  visibleText: string | null;
  uncertainty: string[];
  blockedReason: string | null;
  isVisible: boolean;
  expectedRegionDistance: number | null;
};

type CandidateNormalizationResult =
  | { status: "selected"; candidate: NormalizedCandidate }
  | { status: "failed"; failureReason: VisualTargetFailureReason };

export type VisualTargetSelectionResult =
  | { status: "selected"; candidate: NormalizedCandidate; dataQualityFlags: string[] }
  | { status: "failed" | "review_required"; failureReason: VisualTargetFailureReason; dataQualityFlags: string[] };

function normalizeCandidate(input: {
  candidate: VisualTargetCandidate;
  coordinateSpace: VisualTargetCoordinateSpace;
  confidencePolicy: VisualTargetConfidencePolicy;
  dataQualityPolicy: VisualTargetDataQualityPolicy;
}): CandidateNormalizationResult {
  const coordinateSpace = input.candidate.coordinateSpace ?? input.coordinateSpace;
  if (!coordinateSpace) {
    return { status: "failed", failureReason: "missing_coordinate_space" };
  }
  if (input.dataQualityPolicy.rejectContactSheetCoordinates && coordinateSpace === "contact_sheet") {
    return { status: "failed", failureReason: "contact_sheet_coordinate_forbidden" };
  }
  if (input.dataQualityPolicy.requireScaleMappingForAiInput && coordinateSpace === "ai_input" && !input.candidate.scaleMapping) {
    return { status: "failed", failureReason: "ai_input_scale_mapping_missing" };
  }
  if (input.dataQualityPolicy.requireCandidateRef && input.candidate.sourceKind !== "operator_manual" && !input.candidate.sourceCandidateRef) {
    return { status: "failed", failureReason: "missing_candidate_ref" };
  }
  if (!input.candidate.boundingBox) {
    return { status: "failed", failureReason: "missing_bounding_box" };
  }
  const clickPoint = input.candidate.clickPoint ?? createDefaultClickPoint(input.candidate.boundingBox);
  if (!isPointInsideBoundingBox(clickPoint, input.candidate.boundingBox)) {
    return { status: "failed", failureReason: "click_point_outside_bounding_box" };
  }
  if (input.candidate.confidence < input.confidencePolicy.minConfidence) {
    return { status: "failed", failureReason: "confidence_below_threshold" };
  }
  return {
    status: "selected",
    candidate: {
      sourceCandidateRef: input.candidate.sourceCandidateRef,
      sourceAiResultRef: input.candidate.sourceAiResultRef,
      coordinateSpace,
      boundingBox: input.candidate.boundingBox,
      clickPoint,
      confidence: input.candidate.confidence,
      detectionMethod: input.candidate.detectionMethod,
      visibleText: input.candidate.visibleText,
      uncertainty: input.candidate.uncertainty,
      blockedReason: input.candidate.blockedReason,
      isVisible: input.candidate.isVisible,
      expectedRegionDistance: input.candidate.expectedRegionDistance,
    },
  };
}

function sortCandidates(candidates: NormalizedCandidate[], policy: VisualTargetSelectionPolicy): NormalizedCandidate[] {
  const sorted = [...candidates];
  switch (policy.strategy) {
    case "firstVisible":
      sorted.sort((left, right) => Number(right.isVisible) - Number(left.isVisible) || right.confidence - left.confidence);
      return sorted;
    case "nearestExpectedRegion":
      sorted.sort((left, right) => {
        const leftDistance = left.expectedRegionDistance ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.expectedRegionDistance ?? Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance || right.confidence - left.confidence;
      });
      return sorted;
    case "rejectAmbiguous":
    case "highestConfidence":
    default:
      sorted.sort((left, right) => right.confidence - left.confidence);
      return sorted;
  }
}

export function selectVisualTargetCandidate(input: {
  candidates: VisualTargetCandidate[];
  coordinateSpace: VisualTargetCoordinateSpace;
  confidencePolicy: VisualTargetConfidencePolicy;
  selectionPolicy: VisualTargetSelectionPolicy;
  dataQualityPolicy: VisualTargetDataQualityPolicy;
}): VisualTargetSelectionResult {
  if (input.candidates.length === 0) {
    return { status: "failed", failureReason: "no_candidates", dataQualityFlags: [] };
  }

  const successful: NormalizedCandidate[] = [];
  const failureReasons: VisualTargetFailureReason[] = [];
  const dataQualityFlags = new Set<string>();
  for (const candidate of input.candidates) {
    const result = normalizeCandidate({
      candidate,
      coordinateSpace: input.coordinateSpace,
      confidencePolicy: input.confidencePolicy,
      dataQualityPolicy: input.dataQualityPolicy,
    });
    if (result.status === "selected") {
      successful.push(result.candidate);
      continue;
    }
    failureReasons.push(result.failureReason);
    dataQualityFlags.add(`candidate_rejected:${result.failureReason}`);
  }

  if (successful.length === 0) {
    const failureReason = failureReasons.includes("ai_input_scale_mapping_missing")
      ? "ai_input_scale_mapping_missing"
      : (failureReasons[0] ?? "no_candidates");
    const status = failureReason === "ai_input_scale_mapping_missing" ? "review_required" : "failed";
    return { status, failureReason, dataQualityFlags: [...dataQualityFlags] };
  }

  const sorted = sortCandidates(successful, input.selectionPolicy);
  if (sorted.length > 1) {
    const gap = sorted[0]!.confidence - sorted[1]!.confidence;
    if (gap < input.selectionPolicy.ambiguityConfidenceDelta) {
      dataQualityFlags.add("candidate_selection:ambiguous_confidence_gap");
      return { status: "review_required", failureReason: "ambiguous_candidates", dataQualityFlags: [...dataQualityFlags] };
    }
  }

  return {
    status: "selected",
    candidate: sorted[0]!,
    dataQualityFlags: [...dataQualityFlags],
  };
}