import { buildGateRejectedResult } from "./verification-gate-rejection-result.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import type { PostActionVerificationGateSequenceResult, PostActionVerificationGateSnapshot } from "./verification-gate-sequence.js";

type VerificationClockMark = {
  isoTimestamp: string;
  monotonicMs: number;
};

const buildVerificationGateFailureResult = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  started: VerificationClockMark;
  snapshot: PostActionVerificationGateSnapshot;
  status: "failed" | "review_required";
  failureReason: PostActionFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
}): PostActionVerificationAbilityResult => {
  const ended = input.context.clock.now();

  return buildGateRejectedResult({
    request: input.request,
    context: input.context,
    startedAt: input.started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: input.started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    inputDecision: input.snapshot.inputDecision,
    payloadBudgetDecision: input.snapshot.payloadBudgetDecision,
    actionProofDecision: input.snapshot.actionProofDecision,
    evidenceSourceDecision: input.snapshot.evidenceSourceDecision,
    observationBindingDecision: input.snapshot.observationBindingDecision,
    beforeAfterDecision: input.snapshot.beforeAfterDecision,
    beforeAfterPairDecision: input.snapshot.beforeAfterPairDecision,
    policyDecision: input.snapshot.policyDecision,
    outputBoundaryDecision: input.snapshot.outputBoundaryDecision,
    criticalDataQualityDecision: input.snapshot.criticalDataQualityDecision,
    verificationDecisionTrace: input.snapshot.verificationDecisionTrace,
    dataQualityFlags: input.snapshot.dataQualityFlags,
    diagnosticPayloadRef: input.snapshot.diagnosticPayloadRef,
  });
};

export const failVerificationGate = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  started: VerificationClockMark;
  snapshot: PostActionVerificationGateSnapshot;
  applySnapshot: () => void;
  gate: {
    status?: "failed" | "review_required";
    failureReason?: PostActionFailureReason;
    reviewRequiredReason?: string | null;
    statusMessage?: string;
  };
  status: "failed" | "review_required";
  failureReason: PostActionFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
}): PostActionVerificationGateSequenceResult => {
  input.applySnapshot();

  return {
    ok: false as const,
    result: buildVerificationGateFailureResult({
      request: input.request,
      context: input.context,
      started: input.started,
      snapshot: input.snapshot,
      status: input.gate.status ?? input.status,
      failureReason: input.gate.failureReason ?? input.failureReason,
      reviewRequiredReason: input.gate.reviewRequiredReason ?? input.reviewRequiredReason,
      statusMessage: input.gate.statusMessage ?? input.statusMessage,
    }),
  };
};