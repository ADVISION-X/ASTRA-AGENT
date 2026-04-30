import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason, VisualTargetOutput, VisualTargetRuntimeProof } from "../contract.js";
import { VisualTargetRuntimeProofSchema } from "../schema.js";
import { VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY } from "../shared/visual-target-proof.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import type { VisualTargetFailureTrace } from "./visual-target-input-gate.js";
import type { VisualTargetCandidateScoreTrace } from "./target-selection-gate.js";

export type VisualTargetRuntimeDecisionTrace = {
  payloadBudgetDecision: "allow" | "review_required" | "block";
  screenshotDecision: "allow" | "review_required" | "block";
  aiDecision: "allow" | "review_required" | "block" | "not_required";
  pageStateDecision: "allow" | "review_required" | "block";
  candidateSourceDecision: "allow" | "review_required" | "block";
  candidateSourceBindingDecision: "allow" | "review_required" | "block";
  coordinateSpaceDecision: "allow" | "review_required" | "block";
  targetTypeDecision: "allow" | "review_required" | "block";
  selectionDecision: "selected" | "no_candidate" | "review_required";
  ambiguityDecision: "clear" | "review_required" | "block";
  outputBoundaryDecision: "allow" | "review_required" | "block";
  criticalDataQualityDecision: "clear" | "review_required" | "block";
};

export type VisualTargetRuntimeTelemetry = {
  inputPayloadHash: string;
  candidateSetHash: string;
  selectedCandidateHash: string | null;
  screenshotHash: string | null;
  aiInputHash: string | null;
  aiOutputPayloadHash: string | null;
  pageStateHash: string | null;
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
  ambiguityTrace: string[];
  coordinateTransformTrace: string[];
  diagnosticPayloadRef: string | null;
  debugLogRef: string;
  structuredRuntimeEventRef: string;
};

export function buildVisualTargetRuntimeProof(input: {
  request: ParsedVisualTargetAbilityInput | null;
  trace: VisualTargetFailureTrace;
  output: VisualTargetOutput | null;
  outputRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  rejectedCandidateRefs: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  decisions: VisualTargetRuntimeDecisionTrace;
  telemetry: VisualTargetRuntimeTelemetry;
  dataQualityFlags: VisualTargetDataQualityFlag[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
}): VisualTargetRuntimeProof {
  return VisualTargetRuntimeProofSchema.parse({
    proofId: buildStableVisualTargetRef("visual-target-proof", [input.trace.inputRef, input.outputRef, input.status]),
    runId: buildStableVisualTargetRef("visual-target-run", [input.trace.sessionId, input.trace.childCapabilityId, input.trace.roundId, input.trace.videoVisitId]),
    missionId: input.trace.sessionId,
    sessionId: input.trace.sessionId,
    roundId: input.trace.roundId,
    videoVisitId: input.trace.videoVisitId,
    abilityGroupId: "visual-target",
    childCapabilityId: input.trace.childCapabilityId,
    sourceAbilityGroupId: input.trace.sourceAbilityGroupId,
    sourceChildCapabilityId: input.trace.sourceChildCapabilityId,
    inputRef: input.trace.inputRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.telemetry.diagnosticPayloadRef,
    debugLogRef: input.telemetry.debugLogRef,
    structuredRuntimeEventRef: input.telemetry.structuredRuntimeEventRef,
    inputPayloadHash: input.telemetry.inputPayloadHash,
    screenshotEvidenceId: input.request?.sourceProof.screenshot.screenshotEvidenceId ?? null,
    screenshotProofRef: input.request?.sourceProof.screenshot.screenshotProofRef ?? null,
    screenshotHash: input.telemetry.screenshotHash,
    aiResultRef: input.request?.sourceProof.ai?.aiResultRef ?? null,
    aiProofRef: input.request?.sourceProof.ai?.aiProofRef ?? null,
    aiInputHash: input.telemetry.aiInputHash,
    aiOutputPayloadHash: input.telemetry.aiOutputPayloadHash,
    pageStateProofRef: input.request?.sourceProof.pageState.pageStateProofRef ?? null,
    pageStateHash: input.telemetry.pageStateHash,
    selectedTargetType: input.request?.targetType ?? input.trace.targetType,
    candidateCount: input.request?.candidates.length ?? 0,
    candidateSetHash: input.telemetry.candidateSetHash,
    rejectedCandidateRefs: input.rejectedCandidateRefs,
    candidateScoreTrace: input.telemetry.candidateScoreTrace,
    selectionTrace: input.telemetry.selectionTrace,
    ambiguityTrace: input.telemetry.ambiguityTrace,
    coordinateTransformTrace: input.telemetry.coordinateTransformTrace,
    selectedCandidateRef: input.output?.sourceCandidateRef ?? null,
    selectedCandidateHash: input.telemetry.selectedCandidateHash,
    coordinateSpace: input.output?.coordinateSpace ?? null,
    boundingBox: input.output?.boundingBox ?? null,
    clickPoint: input.output?.targetNature === "action" ? input.output.candidateClickPoint : null,
    geometryGuardHandoffRef: input.output?.geometryGuardHandoffRef ?? null,
    notExecutableUntilGeometryGuard: input.output?.notExecutableUntilGeometryGuard ?? false,
    geometryGuardHandoffRequired: input.output?.geometryGuardHandoffRequired ?? false,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    payloadBudgetDecision: input.decisions.payloadBudgetDecision,
    screenshotDecision: input.decisions.screenshotDecision,
    aiDecision: input.decisions.aiDecision,
    pageStateDecision: input.decisions.pageStateDecision,
    candidateSourceDecision: input.decisions.candidateSourceDecision,
    candidateSourceBindingDecision: input.decisions.candidateSourceBindingDecision,
    coordinateSpaceDecision: input.decisions.coordinateSpaceDecision,
    targetTypeDecision: input.decisions.targetTypeDecision,
    selectionDecision: input.decisions.selectionDecision,
    ambiguityDecision: input.decisions.ambiguityDecision,
    outputBoundaryDecision: input.decisions.outputBoundaryDecision,
    criticalDataQualityDecision: input.decisions.criticalDataQualityDecision,
    dataQualityFlags: input.dataQualityFlags,
    geometryGuardHandoffPolicy: VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY,
    nonExecutableCoordinatePolicy: "not-executable-until-geometry-guard",
    clock: {
      portKind: "system-monotonic-clock",
      startedMonotonicMs: input.clock.startedMonotonicMs,
      endedMonotonicMs: input.clock.endedMonotonicMs,
    },
  });
}