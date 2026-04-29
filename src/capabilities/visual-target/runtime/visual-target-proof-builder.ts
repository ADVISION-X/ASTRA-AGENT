import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason, VisualTargetRuntimeProof } from "../contract.js";
import { VisualTargetRuntimeProofSchema } from "../schema.js";
import { VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY } from "../shared/visual-target-proof.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";

export function buildVisualTargetRuntimeProof(input: {
  request: ParsedVisualTargetAbilityInput;
  outputRef: string;
  status: "success" | "failed" | "review_required" | "blocked";
  failureReason: VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  selectedCandidate: VisualTargetCandidate | null;
  rejectedCandidateRefs: string[];
  coordinateSpace: VisualTargetCandidate["coordinateSpace"] | null;
  boundingBox: VisualTargetCandidate["boundingBox"] | null;
  clickPoint: VisualTargetCandidate["clickPoint"] | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  decisions: {
    screenshotDecision: "allow" | "review_required" | "block";
    aiDecision: "allow" | "review_required" | "block" | "not_required";
    pageStateDecision: "allow" | "review_required" | "block";
    candidateSourceDecision: "allow" | "review_required" | "block";
    coordinateSpaceDecision: "allow" | "review_required" | "block";
    targetTypeDecision: "allow" | "review_required" | "block";
    selectionDecision: "selected" | "no_candidate" | "review_required";
    ambiguityDecision: "clear" | "review_required" | "block";
  };
  dataQualityFlags: VisualTargetDataQualityFlag[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
}): VisualTargetRuntimeProof {
  return VisualTargetRuntimeProofSchema.parse({
    proofId: buildStableVisualTargetRef("visual-target-proof", [input.request.inputRef, input.outputRef, input.status]),
    runId: buildStableVisualTargetRef("visual-target-run", [input.request.sessionId, input.request.childCapabilityId, input.request.roundId, input.request.videoVisitId]),
    missionId: input.request.sessionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: "visual-target",
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.request.inputRef,
    outputRef: input.outputRef,
    screenshotEvidenceId: input.request.sourceProof.screenshot.screenshotEvidenceId,
    screenshotProofRef: input.request.sourceProof.screenshot.screenshotProofRef,
    aiResultRef: input.request.sourceProof.ai?.aiResultRef ?? null,
    aiProofRef: input.request.sourceProof.ai?.aiProofRef ?? null,
    pageStateProofRef: input.request.sourceProof.pageState.pageStateProofRef,
    candidateRef: input.selectedCandidate?.candidateRef ?? null,
    selectedTargetType: input.request.targetType,
    candidateCount: input.request.candidates.length,
    rejectedCandidateRefs: input.rejectedCandidateRefs,
    selectedCandidateRef: input.selectedCandidate?.candidateRef ?? null,
    coordinateSpace: input.coordinateSpace,
    boundingBox: input.boundingBox,
    clickPoint: input.status === "success" ? input.clickPoint : null,
    geometryGuardHandoffRequired: input.status === "success",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    screenshotDecision: input.decisions.screenshotDecision,
    aiDecision: input.decisions.aiDecision,
    pageStateDecision: input.decisions.pageStateDecision,
    candidateSourceDecision: input.decisions.candidateSourceDecision,
    coordinateSpaceDecision: input.decisions.coordinateSpaceDecision,
    targetTypeDecision: input.decisions.targetTypeDecision,
    selectionDecision: input.decisions.selectionDecision,
    ambiguityDecision: input.decisions.ambiguityDecision,
    dataQualityFlags: input.dataQualityFlags,
    geometryGuardHandoffPolicy: VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY,
    clock: {
      portKind: "system-monotonic-clock",
      startedMonotonicMs: input.clock.startedMonotonicMs,
      endedMonotonicMs: input.clock.endedMonotonicMs,
    },
  });
}