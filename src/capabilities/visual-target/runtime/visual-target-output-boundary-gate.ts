import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason, VisualTargetOutput } from "../contract.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";

const CRITICAL_FLAGS = new Set<VisualTargetDataQualityFlag>([
  "critical_data_quality",
  "candidate_bbox_out_of_bounds",
  "candidate_coordinate_non_executable",
  "output_boundary_violation",
]);

function parseMetricValue(visibleText: string | null): number | null {
  if (!visibleText) {
    return null;
  }
  const normalized = visibleText.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return normalized ? Number.parseFloat(normalized[0]) : null;
}

export function validateVisualTargetOutputBoundary(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
  selectedCandidate: VisualTargetResolvedCandidate;
  accumulatedDataQualityFlags: VisualTargetDataQualityFlag[];
}):
  | {
      ok: true;
      decision: "allow";
      criticalDataQualityDecision: "clear";
      output: VisualTargetOutput;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      criticalDataQualityDecision: "review_required" | "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const flags = new Set<VisualTargetDataQualityFlag>([
    ...input.accumulatedDataQualityFlags,
    ...input.selectedCandidate.dataQualityFlags,
  ]);

  if ([...flags].some((flag) => CRITICAL_FLAGS.has(flag))) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      criticalDataQualityDecision: "block",
      failureReason: "critical_data_quality",
      statusMessage: "Visual Target output boundary detected critical data quality drift.",
      reviewRequiredReason: null,
      dataQualityFlags: [...flags],
    };
  }

  if (input.selectedCandidate.confidence < input.profile.minimumConfidence) {
    flags.add("low_confidence");
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      criticalDataQualityDecision: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "Visual Target output boundary rejected low-confidence success output.",
      reviewRequiredReason: "Visual Target requires review because the selected candidate confidence is below threshold.",
      dataQualityFlags: [...flags],
    };
  }

  const commonOutput = {
    targetId: buildStableVisualTargetRef("visual-target", [input.request.childCapabilityId, input.request.inputRef, input.selectedCandidate.candidateRef]),
    sourceCandidateRef: input.selectedCandidate.candidateRef,
    sourceScreenshotEvidenceId: input.request.sourceProof.screenshot.screenshotEvidenceId,
    sourceScreenshotProofRef: input.request.sourceProof.screenshot.screenshotProofRef,
    sourceAiResultRef: input.request.sourceProof.ai?.aiResultRef ?? null,
    sourceAiProofRef: input.request.sourceProof.ai?.aiProofRef ?? null,
    sourcePageStateProofRef: input.request.sourceProof.pageState.pageStateProofRef,
    coordinateSpace: input.selectedCandidate.executableCoordinateSpace,
    originalCandidateCoordinateSpace: input.selectedCandidate.originalCoordinateSpace,
    boundingBox: input.selectedCandidate.executableBoundingBox,
    confidence: input.selectedCandidate.confidence,
    visibleText: input.selectedCandidate.visibleText ?? null,
  };

  if (input.request.targetNature === "action") {
    if (!input.selectedCandidate.executableClickPoint || input.profile.geometryGuardHandoffPolicy !== "required") {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        criticalDataQualityDecision: "review_required",
        failureReason: "click_point_missing",
        statusMessage: "Action target output must stay non-executable until Geometry Guard receives a candidate click point.",
        reviewRequiredReason: "Visual Target requires review because the action output cannot be handed off safely.",
        dataQualityFlags: [...flags, "output_boundary_violation"],
      };
    }
    const geometryGuardHandoffRef = buildStableVisualTargetRef("visual-target-geometry-handoff", [commonOutput.targetId, commonOutput.sourceCandidateRef]);
    return {
      ok: true,
      decision: "allow",
      criticalDataQualityDecision: "clear",
      output: {
        targetNature: "action",
        ...commonOutput,
        candidateClickPoint: input.selectedCandidate.executableClickPoint,
        executable: false,
        actionIntentCandidate: true,
        notExecutableUntilGeometryGuard: true,
        geometryGuardHandoffRequired: true,
        geometryGuardHandoffRef,
        geometryGuardHandoff: {
          handoffRef: geometryGuardHandoffRef,
          handoffKind: "geometry-guard-public-contract-only",
          executionBoundary: "not-executable-until-geometry-guard",
          sourceScreenshotEvidenceId: commonOutput.sourceScreenshotEvidenceId,
          sourceScreenshotProofRef: commonOutput.sourceScreenshotProofRef,
          coordinateSpace: commonOutput.coordinateSpace,
          originalCandidateCoordinateSpace: commonOutput.originalCandidateCoordinateSpace,
          boundingBox: commonOutput.boundingBox,
          clickPoint: input.selectedCandidate.executableClickPoint,
          scaleMapping: input.selectedCandidate.geometryScaleMapping,
        },
        parsedValue: null,
        metricValue: null,
      },
      dataQualityFlags: [...flags],
    };
  }

  if (input.request.targetNature === "region") {
    return {
      ok: true,
      decision: "allow",
      criticalDataQualityDecision: "clear",
      output: {
        targetNature: "region",
        ...commonOutput,
        candidateClickPoint: null,
        executable: false,
        actionIntentCandidate: false,
        notExecutableUntilGeometryGuard: false,
        geometryGuardHandoffRequired: false,
        geometryGuardHandoffRef: null,
        geometryGuardHandoff: null,
        parsedValue: null,
        metricValue: null,
      },
      dataQualityFlags: [...flags],
    };
  }

  return {
    ok: true,
    decision: "allow",
    criticalDataQualityDecision: "clear",
    output: {
      targetNature: "metric",
      ...commonOutput,
      candidateClickPoint: null,
      executable: false,
      actionIntentCandidate: false,
      notExecutableUntilGeometryGuard: false,
      geometryGuardHandoffRequired: false,
      geometryGuardHandoffRef: null,
      geometryGuardHandoff: null,
      parsedValue: parseMetricValue(input.selectedCandidate.visibleText ?? null),
      metricValue: parseMetricValue(input.selectedCandidate.visibleText ?? null),
    },
    dataQualityFlags: [...flags],
  };
}