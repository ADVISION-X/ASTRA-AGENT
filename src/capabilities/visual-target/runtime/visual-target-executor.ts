import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetDataQualityFlag,
  VisualTargetFailureReason,
  VisualTargetOutput,
} from "../contract.js";
import { validateAiResultProof } from "./ai-result-proof-gate.js";
import { validateAmbiguity } from "./ambiguity-gate.js";
import { validateCandidateSources } from "./candidate-source-gate.js";
import { validateCoordinateSpace } from "./coordinate-space-gate.js";
import { validatePageStateConsistency } from "./page-state-consistency-gate.js";
import { validateScreenshotProof } from "./screenshot-proof-gate.js";
import { selectTargetCandidate } from "./target-selection-gate.js";
import { validateTargetTypePolicy } from "./target-type-policy-gate.js";
import { validateVisualTargetOutputBoundary } from "./visual-target-output-boundary-gate.js";
import { validateVisualTargetPayloadBudget } from "./visual-target-payload-budget-gate.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { resolveVisualTargetExecutionProfile } from "./visual-target-input-gate.js";
import type { VisualTargetRuntimeDecisionTrace, VisualTargetRuntimeTelemetry } from "./visual-target-proof-builder.js";
import type { VisualTargetRuntimeContext } from "./visual-target-runtime-context.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";

export async function executeVisualTarget(input: {
  request: ParsedVisualTargetAbilityInput;
  context: VisualTargetRuntimeContext;
}): Promise<VisualTargetAbilityResult> {
  const started = input.context.clock.now();
  const profile = resolveVisualTargetExecutionProfile({
    request: input.request,
    profilePort: input.context.profilePort,
  });
  const rejectedCandidateRefs = new Set<string>();
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();
  const decisions: VisualTargetRuntimeDecisionTrace = {
    payloadBudgetDecision: "allow",
    screenshotDecision: "allow",
    aiDecision: input.request.sourceProof.ai ? "allow" : "not_required",
    pageStateDecision: "allow",
    candidateSourceDecision: "allow",
    candidateSourceBindingDecision: "allow",
    coordinateSpaceDecision: "allow",
    targetTypeDecision: "allow",
    selectionDecision: "selected",
    ambiguityDecision: "clear",
    outputBoundaryDecision: "allow",
    criticalDataQualityDecision: "clear",
  };
  const trace = {
    childCapabilityId: input.request.childCapabilityId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.request.inputRef,
    targetType: input.request.targetType,
    targetNature: input.request.targetNature,
    receivedShapeHash: hashVisualTargetPayload(input.request),
  };
  const telemetry: Omit<VisualTargetRuntimeTelemetry, "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef"> = {
    inputPayloadHash: hashVisualTargetPayload(input.request),
    candidateSetHash: hashVisualTargetPayload(input.request.candidates.map((candidate) => candidate.candidateRef)),
    selectedCandidateHash: null as string | null,
    screenshotHash: input.request.sourceProof.screenshot.imageHash,
    aiInputHash: input.request.sourceProof.ai?.aiInputHash ?? null,
    aiOutputPayloadHash: input.request.sourceProof.ai?.outputPayloadHash ?? null,
    pageStateHash: input.request.sourceProof.pageState.pageStateHash,
    candidateScoreTrace: [] as import("./target-selection-gate.js").VisualTargetCandidateScoreTrace[],
    selectionTrace: [] as string[],
    ambiguityTrace: [] as string[],
    coordinateTransformTrace: [] as string[],
  };

  const finalize = (output: VisualTargetOutput | null, status: "success" | "failed" | "review_required", failureReason: VisualTargetFailureReason | null, reviewRequiredReason: string | null, statusMessage: string) => {
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      trace,
      status,
      failureReason,
      reviewRequiredReason,
      statusMessage,
      output,
      rejectedCandidateRefs: [...rejectedCandidateRefs],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      telemetry,
      dataQualityFlags: [...dataQualityFlags],
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  };

  const payloadGate = validateVisualTargetPayloadBudget({ request: input.request });
  decisions.payloadBudgetDecision = payloadGate.decision;
  telemetry.candidateSetHash = payloadGate.candidateSetHash;
  for (const flag of payloadGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!payloadGate.ok) {
    return finalize(null, payloadGate.status, payloadGate.failureReason, payloadGate.reviewRequiredReason, payloadGate.statusMessage);
  }

  const screenshotGate = validateScreenshotProof({
    request: input.request,
    nowEpochMs: started.epochMs,
    freshnessTtlMs: profile.freshnessTtlMs,
  });
  decisions.screenshotDecision = screenshotGate.decision;
  telemetry.screenshotHash = screenshotGate.screenshotHash;
  for (const flag of screenshotGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!screenshotGate.ok) {
    return finalize(null, screenshotGate.status, screenshotGate.failureReason, screenshotGate.reviewRequiredReason, screenshotGate.statusMessage);
  }

  const aiGate = validateAiResultProof({
    request: input.request,
    nowEpochMs: started.epochMs,
    freshnessTtlMs: profile.freshnessTtlMs,
    minimumConfidence: profile.minimumConfidence,
  });
  decisions.aiDecision = aiGate.decision;
  telemetry.aiInputHash = aiGate.aiInputHash;
  telemetry.aiOutputPayloadHash = aiGate.aiOutputPayloadHash;
  for (const flag of aiGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!aiGate.ok) {
    return finalize(null, aiGate.status, aiGate.failureReason, aiGate.reviewRequiredReason, aiGate.statusMessage);
  }

  const pageStateGate = validatePageStateConsistency({
    request: input.request,
    allowedPageStateTypes: profile.allowedPageStateTypes,
  });
  decisions.pageStateDecision = pageStateGate.decision;
  for (const flag of pageStateGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!pageStateGate.ok) {
    return finalize(null, pageStateGate.status, pageStateGate.failureReason, pageStateGate.reviewRequiredReason, pageStateGate.statusMessage);
  }

  const candidateSourceGate = validateCandidateSources({
    request: input.request,
    nowEpochMs: started.epochMs,
    profile,
  });
  decisions.candidateSourceDecision = candidateSourceGate.decision;
  decisions.candidateSourceBindingDecision = candidateSourceGate.bindingDecision;
  for (const flag of candidateSourceGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!candidateSourceGate.ok) {
    for (const candidateRef of candidateSourceGate.rejectedCandidateRefs) {
      rejectedCandidateRefs.add(candidateRef);
    }
    return finalize(null, candidateSourceGate.status, candidateSourceGate.failureReason, candidateSourceGate.reviewRequiredReason, candidateSourceGate.statusMessage);
  }
  for (const candidateRef of candidateSourceGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }

  const coordinateGate = validateCoordinateSpace({
    request: input.request,
    candidates: candidateSourceGate.candidates,
  });
  decisions.coordinateSpaceDecision = coordinateGate.decision;
  telemetry.coordinateTransformTrace = coordinateGate.coordinateTransformTrace;
  for (const flag of coordinateGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!coordinateGate.ok) {
    for (const candidateRef of coordinateGate.rejectedCandidateRefs) {
      rejectedCandidateRefs.add(candidateRef);
    }
    return finalize(null, coordinateGate.status, coordinateGate.failureReason, coordinateGate.reviewRequiredReason, coordinateGate.statusMessage);
  }
  for (const candidateRef of coordinateGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }

  const targetTypeGate = validateTargetTypePolicy({
    request: input.request,
    candidates: coordinateGate.candidates,
    profile,
  });
  decisions.targetTypeDecision = targetTypeGate.decision;
  for (const flag of targetTypeGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!targetTypeGate.ok) {
    for (const candidateRef of targetTypeGate.rejectedCandidateRefs) {
      rejectedCandidateRefs.add(candidateRef);
    }
    return finalize(null, targetTypeGate.status, targetTypeGate.failureReason, targetTypeGate.reviewRequiredReason, targetTypeGate.statusMessage);
  }
  for (const candidateRef of targetTypeGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }

  const selectionGate = selectTargetCandidate({
    candidates: targetTypeGate.candidates,
    nowEpochMs: started.epochMs,
    freshnessTtlMs: profile.freshnessTtlMs,
    minimumConfidence: profile.minimumConfidence,
  });
  decisions.selectionDecision = selectionGate.decision;
  telemetry.candidateScoreTrace = selectionGate.candidateScoreTrace;
  telemetry.selectionTrace = selectionGate.selectionTrace;
  for (const flag of selectionGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!selectionGate.ok) {
    return finalize(null, selectionGate.status, selectionGate.failureReason, selectionGate.reviewRequiredReason, selectionGate.statusMessage);
  }

  const ambiguityGate = validateAmbiguity({
    candidates: selectionGate.candidates,
    minimumAmbiguityGap: profile.minimumAmbiguityGap,
  });
  decisions.ambiguityDecision = ambiguityGate.decision;
  telemetry.ambiguityTrace = ambiguityGate.ambiguityTrace;
  for (const flag of ambiguityGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!ambiguityGate.ok) {
    return finalize(null, ambiguityGate.status, ambiguityGate.failureReason, ambiguityGate.reviewRequiredReason, ambiguityGate.statusMessage);
  }

  const outputBoundaryGate = validateVisualTargetOutputBoundary({
    request: input.request,
    profile,
    selectedCandidate: selectionGate.selectedCandidate,
    accumulatedDataQualityFlags: [...dataQualityFlags],
  });
  decisions.outputBoundaryDecision = outputBoundaryGate.decision;
  decisions.criticalDataQualityDecision = outputBoundaryGate.criticalDataQualityDecision;
  for (const flag of outputBoundaryGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }
  if (!outputBoundaryGate.ok) {
    return finalize(null, outputBoundaryGate.status, outputBoundaryGate.failureReason, outputBoundaryGate.reviewRequiredReason, outputBoundaryGate.statusMessage);
  }

  telemetry.selectedCandidateHash = hashVisualTargetPayload({
    candidateRef: selectionGate.selectedCandidate.candidateRef,
    coordinateSpace: selectionGate.selectedCandidate.executableCoordinateSpace,
    boundingBox: selectionGate.selectedCandidate.executableBoundingBox,
    clickPoint: selectionGate.selectedCandidate.executableClickPoint,
  });

  return finalize(
    outputBoundaryGate.output,
    "success",
    null,
    null,
    `${input.request.childCapabilityId} selected governed visual target candidate ${selectionGate.selectedCandidate.candidateRef}.`,
  );
}