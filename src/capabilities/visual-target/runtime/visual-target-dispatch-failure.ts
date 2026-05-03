import type { ParsedVisualTargetAbilityInput, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetClockPort } from "../ports/visual-target-clock-port.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { extractVisualTargetFailureTrace } from "./visual-target-input-gate.js";
import type { VisualTargetRuntimeDecisionTrace, VisualTargetRuntimeTelemetry } from "./visual-target-proof-builder.js";

const BLOCKED_DECISIONS: VisualTargetRuntimeDecisionTrace = {
  payloadBudgetDecision: "block",
  screenshotDecision: "block",
  aiDecision: "not_required",
  pageStateDecision: "block",
  candidateSourceDecision: "block",
  candidateSourceBindingDecision: "block",
  coordinateSpaceDecision: "block",
  targetTypeDecision: "block",
  selectionDecision: "no_candidate",
  ambiguityDecision: "block",
  outputBoundaryDecision: "block",
  criticalDataQualityDecision: "block",
};

function createDispatchClockWindow(clock: VisualTargetClockPort): {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
} {
  const started = clock.now();
  const ended = clock.now();
  return {
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
    clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  };
}

function buildParsedFailureTrace(request: ParsedVisualTargetAbilityInput) {
  return {
    childCapabilityId: request.childCapabilityId,
    missionId: request.missionId,
    runId: request.runId,
    sessionId: request.sessionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    stepId: request.stepId,
    mapPackageId: request.mapPackageId,
    mapPackageVersion: request.mapPackageVersion,
    selectedMapId: request.selectedMapId,
    selectedMapVersion: request.selectedMapVersion,
    activationSnapshotRef: request.activationSnapshotRef,
    capabilityCallId: request.capabilityCallId,
    nerveBusEnvelopeId: request.nerveBusEnvelopeId,
    sourceAbilityGroupId: request.sourceAbilityGroupId,
    sourceChildCapabilityId: request.sourceChildCapabilityId,
    inputRef: request.inputRef,
    targetType: request.targetType,
    targetNature: request.targetNature,
    receivedShapeHash: hashVisualTargetPayload(request),
  };
}

function buildDispatchFailureTelemetry(input: {
  inputPayloadHash: string;
  candidateSetHash: string;
  screenshotHash: string | null;
  aiInputHash: string | null;
  aiOutputPayloadHash: string | null;
  pageStateHash: string | null;
  selectionTrace: string[];
}): Omit<VisualTargetRuntimeTelemetry, "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef"> {
  return {
    inputPayloadHash: input.inputPayloadHash,
    candidateSetHash: input.candidateSetHash,
    selectedCandidateHash: null,
    screenshotHash: input.screenshotHash,
    aiInputHash: input.aiInputHash,
    aiOutputPayloadHash: input.aiOutputPayloadHash,
    pageStateHash: input.pageStateHash,
    candidateScoreTrace: [],
    selectionTrace: input.selectionTrace,
    ambiguityTrace: [],
    coordinateTransformTrace: [],
  };
}

export function dispatchVisualTargetInvalidInputFailure(input: {
  rawInput: unknown;
  clock: VisualTargetClockPort;
  parseError: string;
  statusMessage: string;
}) {
  const trace = extractVisualTargetFailureTrace(input.rawInput);
  const clockWindow = createDispatchClockWindow(input.clock);
  return buildVisualTargetResult({
    request: null,
    trace,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    statusMessage: `${input.statusMessage} ${input.parseError}`.trim(),
    output: null,
    rejectedCandidateRefs: [],
    startedAt: clockWindow.startedAt,
    endedAt: clockWindow.endedAt,
    durationMs: clockWindow.durationMs,
    decisions: BLOCKED_DECISIONS,
    telemetry: buildDispatchFailureTelemetry({
      inputPayloadHash: trace.receivedShapeHash,
      candidateSetHash: hashVisualTargetPayload([]),
      screenshotHash: null,
      aiInputHash: null,
      aiOutputPayloadHash: null,
      pageStateHash: null,
      selectionTrace: ["dispatch failure: invalid input rejected before registry dispatch"],
    }),
    dataQualityFlags: ["dispatch_failure"],
    clock: clockWindow.clock,
  });
}

export function dispatchParsedVisualTargetFailure(input: {
  request: ParsedVisualTargetAbilityInput;
  clock: VisualTargetClockPort;
  failureReason: Exclude<VisualTargetFailureReason, "input_schema_invalid">;
  statusMessage: string;
}) {
  const trace = buildParsedFailureTrace(input.request);
  const clockWindow = createDispatchClockWindow(input.clock);
  return buildVisualTargetResult({
    request: input.request,
    trace,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    output: null,
    rejectedCandidateRefs: [],
    startedAt: clockWindow.startedAt,
    endedAt: clockWindow.endedAt,
    durationMs: clockWindow.durationMs,
    decisions: BLOCKED_DECISIONS,
    telemetry: buildDispatchFailureTelemetry({
      inputPayloadHash: trace.receivedShapeHash,
      candidateSetHash: hashVisualTargetPayload(input.request.candidates.map((candidate) => candidate.candidateRef)),
      screenshotHash: input.request.sourceProof.screenshot.imageHash,
      aiInputHash: input.request.sourceProof.ai?.aiInputHash ?? null,
      aiOutputPayloadHash: input.request.sourceProof.ai?.outputPayloadHash ?? null,
      pageStateHash: input.request.sourceProof.pageState.pageStateHash,
      selectionTrace: ["dispatch failure: parsed request failed before child execution completed"],
    }),
    dataQualityFlags: ["dispatch_failure"],
    clock: clockWindow.clock,
  });
}