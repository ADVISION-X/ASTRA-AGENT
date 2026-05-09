import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason, VisualTargetOutput } from "../contract.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
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

type VisualTargetCommonOutput = Omit<VisualTargetOutput, "targetNature" | "candidateClickPoint" | "executable" | "actionIntentCandidate" | "notExecutableUntilGeometryGuard" | "geometryGuardHandoffRequired" | "geometryGuardHandoffRef" | "geometryGuardHandoff" | "parsedValue" | "metricValue">;

type OutputBoundaryAllow = VisualTargetGateSuccess<"allow", {
  criticalDataQualityDecision: "clear";
  output: VisualTargetOutput;
}>;

type OutputBoundaryBlocked = VisualTargetGateBlocked<"block", {
  criticalDataQualityDecision: "block";
}>;

type OutputBoundaryReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  criticalDataQualityDecision: "review_required";
}>;

function createOutputBoundaryBlocked(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  dataQualityFlags: VisualTargetDataQualityFlag[],
): OutputBoundaryBlocked {
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage,
    dataQualityFlags,
    extra: { criticalDataQualityDecision: "block" },
  });
}

function createOutputBoundaryReview(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  reviewRequiredReason: string,
  dataQualityFlags: VisualTargetDataQualityFlag[],
): OutputBoundaryReviewRequired {
  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason,
    statusMessage,
    reviewRequiredReason,
    dataQualityFlags,
    extra: { criticalDataQualityDecision: "review_required" },
  });
}

function buildCommonOutput(input: {
  request: ParsedVisualTargetAbilityInput;
  selectedCandidate: VisualTargetResolvedCandidate;
}): VisualTargetCommonOutput {
  return {
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
}

function buildActionOutput(input: {
  request: ParsedVisualTargetAbilityInput;
  commonOutput: VisualTargetCommonOutput;
  outputFlags: VisualTargetDataQualityFlag[];
  selectedCandidate: VisualTargetResolvedCandidate;
}): VisualTargetOutput {
  const visualTargetResultRef = buildStableVisualTargetRef("visual-target-output", [
    input.request.inputRef,
    input.commonOutput.targetId,
    input.commonOutput.sourceCandidateRef,
  ]);
  const geometryGuardHandoffRef = buildStableVisualTargetRef("visual-target-geometry-handoff", [input.commonOutput.targetId, input.commonOutput.sourceCandidateRef]);
  const clickPoint = input.selectedCandidate.executableClickPoint!;
  return {
    targetNature: "action",
    ...input.commonOutput,
    candidateClickPoint: clickPoint,
    executable: false,
    actionIntentCandidate: true,
    notExecutableUntilGeometryGuard: true,
    geometryGuardHandoffRequired: true,
    geometryGuardHandoffRef,
    geometryGuardHandoff: {
      handoffRef: geometryGuardHandoffRef,
      handoffKind: "geometry-guard-public-contract-only",
      executionBoundary: "not-executable-until-geometry-guard",
      sourceVisualTargetResultRef: visualTargetResultRef,
      sourceTargetRef: input.commonOutput.targetId,
      sourceScreenshotEvidenceRef: input.commonOutput.sourceScreenshotEvidenceId,
      sourceAiResultRef: input.commonOutput.sourceAiResultRef,
      sourcePageStateProofRef: input.commonOutput.sourcePageStateProofRef,
      sourceScreenshotEvidenceId: input.commonOutput.sourceScreenshotEvidenceId,
      sourceScreenshotProofRef: input.commonOutput.sourceScreenshotProofRef,
      coordinateSpace: input.commonOutput.coordinateSpace,
      originalCandidateCoordinateSpace: input.commonOutput.originalCandidateCoordinateSpace,
      bbox: input.commonOutput.boundingBox,
      clickPoint,
      targetType: input.request.targetType,
      targetNature: input.request.targetNature,
      confidence: input.commonOutput.confidence,
      dataQualityFlags: input.outputFlags,
      scaleMapping: input.selectedCandidate.geometryScaleMapping,
    },
    parsedValue: null,
    metricValue: null,
  };
}

function buildRegionOutput(commonOutput: VisualTargetCommonOutput): VisualTargetOutput {
  return {
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
  };
}

function buildMetricOutput(input: {
  commonOutput: VisualTargetCommonOutput;
  selectedCandidate: VisualTargetResolvedCandidate;
}): VisualTargetOutput {
  const parsedValue = parseMetricValue(input.selectedCandidate.visibleText ?? null);
  return {
    targetNature: "metric",
    ...input.commonOutput,
    candidateClickPoint: null,
    executable: false,
    actionIntentCandidate: false,
    notExecutableUntilGeometryGuard: false,
    geometryGuardHandoffRequired: false,
    geometryGuardHandoffRef: null,
    geometryGuardHandoff: null,
    parsedValue,
    metricValue: parsedValue,
  };
}

function createAllowedOutputBoundaryResult(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
  selectedCandidate: VisualTargetResolvedCandidate;
  commonOutput: VisualTargetCommonOutput;
  outputFlags: VisualTargetDataQualityFlag[];
}): OutputBoundaryAllow | OutputBoundaryReviewRequired {
  if (input.request.targetNature === "action") {
    if (!input.selectedCandidate.executableClickPoint || input.profile.geometryGuardHandoffPolicy !== "required") {
      return createOutputBoundaryReview(
        "click_point_missing",
        "Action target output must stay non-executable until Geometry Guard receives a candidate click point.",
        "Visual Target requires review because the action output cannot be handed off safely.",
        [...input.outputFlags, "output_boundary_violation"],
      );
    }
    return createVisualTargetGateSuccess("allow", input.outputFlags, {
      criticalDataQualityDecision: "clear",
      output: buildActionOutput({
        request: input.request,
        commonOutput: input.commonOutput,
        outputFlags: input.outputFlags,
        selectedCandidate: input.selectedCandidate,
      }),
    });
  }
  return input.request.targetNature === "region"
    ? createVisualTargetGateSuccess("allow", input.outputFlags, {
      criticalDataQualityDecision: "clear",
      output: buildRegionOutput(input.commonOutput),
    })
    : createVisualTargetGateSuccess("allow", input.outputFlags, {
      criticalDataQualityDecision: "clear",
      output: buildMetricOutput({ commonOutput: input.commonOutput, selectedCandidate: input.selectedCandidate }),
    });
}

export function validateVisualTargetOutputBoundary(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
  selectedCandidate: VisualTargetResolvedCandidate;
  accumulatedDataQualityFlags: VisualTargetDataQualityFlag[];
}): OutputBoundaryAllow | OutputBoundaryBlocked | OutputBoundaryReviewRequired {
  const flags = new Set<VisualTargetDataQualityFlag>([
    ...input.accumulatedDataQualityFlags,
    ...input.selectedCandidate.dataQualityFlags,
  ]);
  const outputFlags = collectVisualTargetFlags(flags);

  if ([...flags].some((flag) => CRITICAL_FLAGS.has(flag))) {
    return createOutputBoundaryBlocked(
      "critical_data_quality",
      "Visual Target output boundary detected critical data quality drift.",
      outputFlags,
    );
  }

  const commonOutput = buildCommonOutput(input);
  return createAllowedOutputBoundaryResult({
    request: input.request,
    profile: input.profile,
    selectedCandidate: input.selectedCandidate,
    commonOutput,
    outputFlags,
  });
}