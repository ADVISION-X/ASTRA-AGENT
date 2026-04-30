import type { ParsedVisualTargetAbilityInput, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetClockPort } from "../ports/visual-target-clock-port.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { extractVisualTargetFailureTrace } from "./visual-target-input-gate.js";
import type { VisualTargetRuntimeDecisionTrace } from "./visual-target-proof-builder.js";

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

export function dispatchVisualTargetInvalidInputFailure(input: {
  rawInput: unknown;
  clock: VisualTargetClockPort;
  parseError: string;
  statusMessage: string;
}) {
  const trace = extractVisualTargetFailureTrace(input.rawInput);
  const started = input.clock.now();
  const ended = input.clock.now();
  return buildVisualTargetResult({
    request: null,
    trace,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    statusMessage: `${input.statusMessage} ${input.parseError}`.trim(),
    output: null,
    rejectedCandidateRefs: [],
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
    decisions: BLOCKED_DECISIONS,
    telemetry: {
      inputPayloadHash: trace.receivedShapeHash,
      candidateSetHash: hashVisualTargetPayload([]),
      selectedCandidateHash: null,
      screenshotHash: null,
      aiInputHash: null,
      aiOutputPayloadHash: null,
      pageStateHash: null,
      candidateScoreTrace: [],
      selectionTrace: ["dispatch failure: invalid input rejected before registry dispatch"],
      ambiguityTrace: [],
      coordinateTransformTrace: [],
    },
    dataQualityFlags: ["dispatch_failure"],
    clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  });
}

export function dispatchParsedVisualTargetFailure(input: {
  request: ParsedVisualTargetAbilityInput;
  clock: VisualTargetClockPort;
  failureReason: Exclude<VisualTargetFailureReason, "input_schema_invalid">;
  statusMessage: string;
}) {
  const started = input.clock.now();
  const ended = input.clock.now();
  return buildVisualTargetResult({
    request: input.request,
    trace: {
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
    },
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    output: null,
    rejectedCandidateRefs: [],
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
    decisions: BLOCKED_DECISIONS,
    telemetry: {
      inputPayloadHash: hashVisualTargetPayload(input.request),
      candidateSetHash: hashVisualTargetPayload(input.request.candidates.map((candidate) => candidate.candidateRef)),
      selectedCandidateHash: null,
      screenshotHash: input.request.sourceProof.screenshot.imageHash,
      aiInputHash: input.request.sourceProof.ai?.aiInputHash ?? null,
      aiOutputPayloadHash: input.request.sourceProof.ai?.outputPayloadHash ?? null,
      pageStateHash: input.request.sourceProof.pageState.pageStateHash,
      candidateScoreTrace: [],
      selectionTrace: ["dispatch failure: parsed request failed before child execution completed"],
      ambiguityTrace: [],
      coordinateTransformTrace: [],
    },
    dataQualityFlags: ["dispatch_failure"],
    clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  });
}