import { validatePostActionOutputBoundary } from "./post-action-output-boundary-gate.js";
import { finalizeVerificationDecision } from "./verification-decision-gate.js";
import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionChildAssessment, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import type { PostActionVerificationGateSnapshot } from "./verification-gate-sequence.js";

type VerificationClockMark = {
  isoTimestamp: string;
  monotonicMs: number;
};

const buildRuntimeProofInput = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  gateSnapshot: PostActionVerificationGateSnapshot;
  ended: VerificationClockMark;
  finalDecision: ReturnType<typeof finalizeVerificationDecision>;
  outputBoundaryGate: ReturnType<typeof validatePostActionOutputBoundary>;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
}) => ({
  request: input.request,
  context: input.context,
  startedAt: input.gateSnapshot.startedAt,
  endedAt: input.ended.isoTimestamp,
  startedMonotonicMs: input.gateSnapshot.startedMonotonicMs,
  endedMonotonicMs: input.ended.monotonicMs,
  status: input.finalDecision.status,
  verificationDecision: input.finalDecision.verificationDecision,
  confidence: input.finalDecision.confidence,
  failureReason: input.finalDecision.failureReason,
  reviewRequiredReason: input.finalDecision.reviewRequiredReason,
  inputDecision: input.gateSnapshot.inputDecision,
  actionProofDecision: input.gateSnapshot.actionProofDecision,
  evidenceSourceDecision: input.gateSnapshot.evidenceSourceDecision,
  beforeAfterDecision: input.gateSnapshot.beforeAfterDecision,
  policyDecision: input.gateSnapshot.policyDecision,
  outputBoundaryDecision: input.outputBoundaryGate.outputBoundaryDecision,
  criticalDataQualityDecision: input.outputBoundaryGate.criticalDataQualityDecision,
  observationBindingDecision: input.gateSnapshot.observationBindingDecision,
  beforeAfterPairDecision: input.gateSnapshot.beforeAfterPairDecision,
  verificationDecisionTrace: input.finalDecision.verificationDecisionTrace,
  dataQualityFlags: input.finalDecision.dataQualityFlags,
  inputRef: input.request.inputRef,
  outputRef: input.outputRef,
  diagnosticPayloadRef: input.diagnosticPayloadRef,
});

const buildVerificationResultInput = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  finalDecision: ReturnType<typeof finalizeVerificationDecision>;
  runtimeProof: ReturnType<typeof buildPostActionRuntimeProof>;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
}) => ({
  request: input.request,
  assessment: input.assessment,
  status: input.finalDecision.status,
  verificationDecision: input.finalDecision.verificationDecision,
  failureReason: input.finalDecision.failureReason,
  reviewRequiredReason: input.finalDecision.reviewRequiredReason,
  statusMessage: input.finalDecision.statusMessage,
  runtimeProof: input.runtimeProof,
  diagnosticPayloadRef: input.outputRef === null ? input.diagnosticPayloadRef : null,
  dataQualityFlags: input.finalDecision.dataQualityFlags,
});

export function completePostActionVerification(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  assessment: PostActionChildAssessment;
  gateSnapshot: PostActionVerificationGateSnapshot;
  ended: VerificationClockMark;
}): PostActionVerificationAbilityResult {
  const outputBoundaryGate = validatePostActionOutputBoundary({ request: input.request, assessment: input.assessment });
  const finalDecision = finalizeVerificationDecision({ request: input.request, assessment: input.assessment, outputBoundaryGate });
  const outputRef = finalDecision.status === "success"
    ? `${input.request.inputRef}:${input.request.childCapabilityId}:verified`
    : null;

  const runtimeProof = buildPostActionRuntimeProof(
    buildRuntimeProofInput({
      request: input.request,
      context: input.context,
      gateSnapshot: input.gateSnapshot,
      ended: input.ended,
      finalDecision,
      outputBoundaryGate,
      outputRef,
      diagnosticPayloadRef: outputRef === null ? input.gateSnapshot.diagnosticPayloadRef : null,
    }),
  );

  return buildPostActionVerificationResult(
    buildVerificationResultInput({
      request: input.request,
      assessment: input.assessment,
      finalDecision,
      runtimeProof,
      outputRef,
      diagnosticPayloadRef: input.gateSnapshot.diagnosticPayloadRef,
    }),
  );
}