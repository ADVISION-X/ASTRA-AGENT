import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetCandidate,
  VisualTargetDataQualityFlag,
  VisualTargetFailureReason,
  VisualTargetOutput,
} from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { resolveVisualTargetExecutionProfile } from "./visual-target-input-gate.js";
import type { VisualTargetRuntimeDecisionTrace, VisualTargetRuntimeTelemetry } from "./visual-target-proof-builder.js";
import type { VisualTargetRuntimeContext } from "./visual-target-runtime-context.js";
import type { VisualTargetCandidateScoreTrace } from "./target-selection-gate.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";

export type VisualTargetClockSnapshot = {
  isoTimestamp: string;
  epochMs: number;
  monotonicMs: number;
};

export type VisualTargetExecutionState = {
  input: {
    request: ParsedVisualTargetAbilityInput;
    context: VisualTargetRuntimeContext;
  };
  started: VisualTargetClockSnapshot;
  profile: ReturnType<typeof resolveVisualTargetExecutionProfile>;
  rejectedCandidateRefs: Set<string>;
  dataQualityFlags: Set<VisualTargetDataQualityFlag>;
  decisions: VisualTargetRuntimeDecisionTrace;
  trace: {
    childCapabilityId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    sourceAbilityGroupId: string;
    sourceChildCapabilityId: string;
    inputRef: string;
    targetType: ParsedVisualTargetAbilityInput["targetType"];
    targetNature: ParsedVisualTargetAbilityInput["targetNature"];
    receivedShapeHash: string;
  };
  telemetry: Omit<VisualTargetRuntimeTelemetry, "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef">;
  candidateSourceCandidates: VisualTargetCandidate[];
  coordinateCandidates: VisualTargetResolvedCandidate[];
  targetTypeCandidates: VisualTargetResolvedCandidate[];
  selectedCandidates: VisualTargetResolvedCandidate[];
  selectedCandidate: VisualTargetResolvedCandidate | null;
  output: VisualTargetOutput | null;
};

function buildInitialDecisions(request: ParsedVisualTargetAbilityInput): VisualTargetRuntimeDecisionTrace {
  return {
    payloadBudgetDecision: "allow",
    screenshotDecision: "allow",
    aiDecision: request.sourceProof.ai ? "allow" : "not_required",
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
}

function buildExecutionTrace(request: ParsedVisualTargetAbilityInput) {
  return {
    childCapabilityId: request.childCapabilityId,
    sessionId: request.sessionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    sourceAbilityGroupId: request.sourceAbilityGroupId,
    sourceChildCapabilityId: request.sourceChildCapabilityId,
    inputRef: request.inputRef,
    targetType: request.targetType,
    targetNature: request.targetNature,
    receivedShapeHash: hashVisualTargetPayload(request),
  };
}

function buildExecutionTelemetry(
  request: ParsedVisualTargetAbilityInput,
): Omit<VisualTargetRuntimeTelemetry, "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef"> {
  return {
    inputPayloadHash: hashVisualTargetPayload(request),
    candidateSetHash: hashVisualTargetPayload(request.candidates.map((candidate) => candidate.candidateRef)),
    selectedCandidateHash: null,
    screenshotHash: request.sourceProof.screenshot.imageHash,
    aiInputHash: request.sourceProof.ai?.aiInputHash ?? null,
    aiOutputPayloadHash: request.sourceProof.ai?.outputPayloadHash ?? null,
    pageStateHash: request.sourceProof.pageState.pageStateHash,
    candidateScoreTrace: [] as VisualTargetCandidateScoreTrace[],
    selectionTrace: [],
    ambiguityTrace: [],
    coordinateTransformTrace: [],
  };
}

export function createVisualTargetExecutionState(input: {
  request: ParsedVisualTargetAbilityInput;
  context: VisualTargetRuntimeContext;
}): VisualTargetExecutionState {
  const started = input.context.clock.now();
  return {
    input,
    started,
    profile: resolveVisualTargetExecutionProfile({ request: input.request, profilePort: input.context.profilePort }),
    rejectedCandidateRefs: new Set<string>(),
    dataQualityFlags: new Set<VisualTargetDataQualityFlag>(),
    decisions: buildInitialDecisions(input.request),
    trace: buildExecutionTrace(input.request),
    telemetry: buildExecutionTelemetry(input.request),
    candidateSourceCandidates: [],
    coordinateCandidates: [],
    targetTypeCandidates: [],
    selectedCandidates: [],
    selectedCandidate: null,
    output: null,
  };
}

export function addDataQualityFlags(target: Set<VisualTargetDataQualityFlag>, flags: VisualTargetDataQualityFlag[]): void {
  for (const flag of flags) {
    target.add(flag);
  }
}

export function addRejectedCandidateRefs(target: Set<string>, candidateRefs: string[]): void {
  for (const candidateRef of candidateRefs) {
    target.add(candidateRef);
  }
}

export function finalizeVisualTargetExecution(input: {
  state: VisualTargetExecutionState;
  output: VisualTargetOutput | null;
  status: "success" | "failed" | "review_required";
  failureReason: VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
}): VisualTargetAbilityResult {
  const ended = input.state.input.context.clock.now();
  return buildVisualTargetResult({
    request: input.state.input.request,
    trace: input.state.trace,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    output: input.output,
    rejectedCandidateRefs: [...input.state.rejectedCandidateRefs],
    startedAt: input.state.started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - input.state.started.monotonicMs)),
    decisions: input.state.decisions,
    telemetry: input.state.telemetry,
    dataQualityFlags: [...input.state.dataQualityFlags],
    clock: { startedMonotonicMs: input.state.started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  });
}