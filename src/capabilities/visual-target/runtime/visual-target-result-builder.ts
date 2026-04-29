import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetCandidate,
  VisualTargetDataQualityFlag,
  VisualTargetFailureReason,
  VisualTargetNature,
} from "../contract.js";
import { VisualTargetAbilityResultSchema } from "../schema.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import { buildVisualTargetRuntimeProof } from "./visual-target-proof-builder.js";

export function buildVisualTargetResult(input: {
  request: ParsedVisualTargetAbilityInput;
  targetNature: VisualTargetNature;
  status: "success" | "failed" | "review_required" | "blocked";
  failureReason: VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  selectedCandidate: VisualTargetCandidate | null;
  rejectedCandidateRefs: string[];
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
}): VisualTargetAbilityResult {
  const outputRef = buildStableVisualTargetRef("visual-target-output", [input.request.inputRef, input.status, input.selectedCandidate?.candidateRef ?? "none"]);
  const targetId = input.status === "success"
    ? buildStableVisualTargetRef("visual-target", [input.request.childCapabilityId, input.selectedCandidate?.candidateRef, input.request.sourceProof.screenshot.screenshotEvidenceId])
    : null;
  const runtimeProof = buildVisualTargetRuntimeProof({
    request: input.request,
    outputRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    selectedCandidate: input.selectedCandidate,
    rejectedCandidateRefs: input.rejectedCandidateRefs,
    coordinateSpace: input.status === "success" ? input.selectedCandidate?.coordinateSpace ?? null : null,
    boundingBox: input.status === "success" ? input.selectedCandidate?.boundingBox ?? null : null,
    clickPoint: input.status === "success" ? input.selectedCandidate?.clickPoint ?? null : null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    decisions: input.decisions,
    dataQualityFlags: input.dataQualityFlags,
    clock: input.clock,
  });

  return VisualTargetAbilityResultSchema.parse({
    abilityGroupId: "visual-target",
    childCapabilityId: input.request.childCapabilityId,
    targetNature: input.targetNature,
    status: input.status,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    targetType: input.request.targetType,
    targetId,
    sourceScreenshotEvidenceId: input.request.sourceProof.screenshot.screenshotEvidenceId,
    sourceScreenshotProofRef: input.request.sourceProof.screenshot.screenshotProofRef,
    sourceAiResultRef: input.request.sourceProof.ai?.aiResultRef ?? null,
    sourceAiProofRef: input.request.sourceProof.ai?.aiProofRef ?? null,
    sourcePageStateProofRef: input.request.sourceProof.pageState.pageStateProofRef,
    sourceCandidateRef: input.status === "success" ? input.selectedCandidate?.candidateRef ?? null : null,
    coordinateSpace: input.status === "success" ? input.selectedCandidate?.coordinateSpace ?? null : null,
    boundingBox: input.status === "success" ? input.selectedCandidate?.boundingBox ?? null : null,
    clickPoint: input.status === "success" ? input.selectedCandidate?.clickPoint ?? null : null,
    executableCoordinate: null,
    confidence: input.status === "success" ? input.selectedCandidate?.confidence ?? null : null,
    requiresGeometryGuard: input.status === "success",
    geometryGuardHandoffRequired: input.status === "success",
    actionable: input.status === "success" && input.targetNature === "action",
    detectionMethod: input.status === "success" ? input.selectedCandidate?.detectionMethod ?? null : null,
    visibleText: input.status === "success" ? input.selectedCandidate?.visibleText ?? null : null,
    uncertainty: input.status === "success" ? input.selectedCandidate?.uncertainty ?? [] : [],
    blockedReason: input.status === "success" ? input.selectedCandidate?.blockedReason ?? null : null,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    debugLogRef: outputRef,
    dataQualityFlags: input.dataQualityFlags,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    createdAt: input.endedAt,
    durationMs: input.durationMs,
    runtimeProof,
  });
}