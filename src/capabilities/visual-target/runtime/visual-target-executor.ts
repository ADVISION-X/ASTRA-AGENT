import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityContext,
  VisualTargetAbilityResult,
  VisualTargetDataQualityFlag,
} from "../contract.js";
import { validateAiResultProof } from "./ai-result-proof-gate.js";
import { validateAmbiguity } from "./ambiguity-gate.js";
import { validateCandidateSources } from "./candidate-source-gate.js";
import { validateCoordinateSpace } from "./coordinate-space-gate.js";
import { validatePageStateConsistency } from "./page-state-consistency-gate.js";
import { validateScreenshotProof } from "./screenshot-proof-gate.js";
import { selectTargetCandidate } from "./target-selection-gate.js";
import { validateTargetTypePolicy } from "./target-type-policy-gate.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { buildVisualTargetExecutionSeed, resolveVisualTargetExecutionProfile } from "./visual-target-input-gate.js";

export async function executeVisualTarget(input: {
  request: ParsedVisualTargetAbilityInput;
  context: VisualTargetAbilityContext;
}): Promise<VisualTargetAbilityResult> {
  const started = input.context.clock.now();
  const nowIso = started.isoTimestamp;
  const profile = resolveVisualTargetExecutionProfile({
    request: input.request,
    profilePort: input.context.profilePort,
  });
  const seed = buildVisualTargetExecutionSeed(input.request);
  const rejectedCandidateRefs = new Set<string>();
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();
  const decisions: Parameters<typeof buildVisualTargetResult>[0]["decisions"] = {
    screenshotDecision: "allow" as const,
    aiDecision: "not_required" as const,
    pageStateDecision: "allow" as const,
    candidateSourceDecision: "allow" as const,
    coordinateSpaceDecision: "allow" as const,
    targetTypeDecision: "allow" as const,
    selectionDecision: "selected" as const,
    ambiguityDecision: "clear" as const,
  };

  const screenshotGate = validateScreenshotProof({
    request: input.request,
    nowIso,
    freshnessTtlMs: profile.freshnessTtlMs,
  });
  if (!screenshotGate.ok) {
    decisions.screenshotDecision = screenshotGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: screenshotGate.status,
      failureReason: screenshotGate.failureReason,
      reviewRequiredReason: screenshotGate.reviewRequiredReason,
      statusMessage: screenshotGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: screenshotGate.dataQualityFlags,
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }

  const aiGate = validateAiResultProof({
    request: input.request,
    nowIso,
    freshnessTtlMs: profile.freshnessTtlMs,
    minimumConfidence: profile.minimumConfidence,
  });
  if (!aiGate.ok) {
    decisions.aiDecision = aiGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: aiGate.status,
      failureReason: aiGate.failureReason,
      reviewRequiredReason: aiGate.reviewRequiredReason,
      statusMessage: aiGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: aiGate.dataQualityFlags,
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }
  decisions.aiDecision = aiGate.decision;

  const pageStateGate = validatePageStateConsistency({
    request: input.request,
    allowedPageStateTypes: profile.allowedPageStateTypes,
  });
  if (!pageStateGate.ok) {
    decisions.pageStateDecision = pageStateGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: pageStateGate.status,
      failureReason: pageStateGate.failureReason,
      reviewRequiredReason: pageStateGate.reviewRequiredReason,
      statusMessage: pageStateGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: pageStateGate.dataQualityFlags,
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }

  const candidateSourceGate = validateCandidateSources({
    request: input.request,
    nowIso,
    freshnessTtlMs: profile.freshnessTtlMs,
    allowOperatorManual: profile.allowOperatorManual,
  });
  if (!candidateSourceGate.ok) {
    decisions.candidateSourceDecision = candidateSourceGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: candidateSourceGate.status,
      failureReason: candidateSourceGate.failureReason,
      reviewRequiredReason: candidateSourceGate.reviewRequiredReason,
      statusMessage: candidateSourceGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: candidateSourceGate.rejectedCandidateRefs,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: candidateSourceGate.dataQualityFlags,
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }
  for (const candidateRef of candidateSourceGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }
  for (const flag of candidateSourceGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }

  const coordinateGate = validateCoordinateSpace({
    request: input.request,
    candidates: candidateSourceGate.candidates,
  });
  if (!coordinateGate.ok) {
    decisions.coordinateSpaceDecision = coordinateGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: coordinateGate.status,
      failureReason: coordinateGate.failureReason,
      reviewRequiredReason: coordinateGate.reviewRequiredReason,
      statusMessage: coordinateGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [...rejectedCandidateRefs, ...coordinateGate.rejectedCandidateRefs],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: [...dataQualityFlags, ...coordinateGate.dataQualityFlags],
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }
  for (const candidateRef of coordinateGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }
  for (const flag of coordinateGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }

  const targetTypeGate = validateTargetTypePolicy({
    request: input.request,
    candidates: coordinateGate.candidates,
    requireClickPoint: profile.requireClickPoint,
  });
  if (!targetTypeGate.ok) {
    decisions.targetTypeDecision = targetTypeGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: targetTypeGate.status,
      failureReason: targetTypeGate.failureReason,
      reviewRequiredReason: targetTypeGate.reviewRequiredReason,
      statusMessage: targetTypeGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [...rejectedCandidateRefs, ...targetTypeGate.rejectedCandidateRefs],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: [...dataQualityFlags, ...targetTypeGate.dataQualityFlags],
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }
  for (const candidateRef of targetTypeGate.rejectedCandidateRefs) {
    rejectedCandidateRefs.add(candidateRef);
  }
  for (const flag of targetTypeGate.dataQualityFlags) {
    dataQualityFlags.add(flag);
  }

  const selectionGate = selectTargetCandidate({
    candidates: targetTypeGate.candidates,
    nowIso,
    freshnessTtlMs: profile.freshnessTtlMs,
    minimumConfidence: profile.minimumConfidence,
  });
  if (!selectionGate.ok) {
    decisions.selectionDecision = selectionGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: selectionGate.status,
      failureReason: selectionGate.failureReason,
      reviewRequiredReason: selectionGate.reviewRequiredReason,
      statusMessage: selectionGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [...rejectedCandidateRefs],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: [...dataQualityFlags, ...selectionGate.dataQualityFlags],
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }

  const ambiguityGate = validateAmbiguity({
    candidates: selectionGate.candidates,
    minimumAmbiguityGap: profile.minimumAmbiguityGap,
  });
  if (!ambiguityGate.ok) {
    decisions.ambiguityDecision = ambiguityGate.decision;
    const ended = input.context.clock.now();
    return buildVisualTargetResult({
      request: input.request,
      targetNature: seed.targetNature,
      status: ambiguityGate.status,
      failureReason: ambiguityGate.failureReason,
      reviewRequiredReason: ambiguityGate.reviewRequiredReason,
      statusMessage: ambiguityGate.statusMessage,
      selectedCandidate: null,
      rejectedCandidateRefs: [...rejectedCandidateRefs],
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
      decisions,
      dataQualityFlags: [...dataQualityFlags, ...ambiguityGate.dataQualityFlags],
      clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
    });
  }

  const ended = input.context.clock.now();
  return buildVisualTargetResult({
    request: input.request,
    targetNature: seed.targetNature,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: `${input.request.childCapabilityId} selected governed visual target candidate ${selectionGate.selectedCandidate.candidateRef}.`,
    selectedCandidate: selectionGate.selectedCandidate,
    rejectedCandidateRefs: [...rejectedCandidateRefs],
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
    decisions,
    dataQualityFlags: [...dataQualityFlags, ...selectionGate.dataQualityFlags],
    clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  });
}