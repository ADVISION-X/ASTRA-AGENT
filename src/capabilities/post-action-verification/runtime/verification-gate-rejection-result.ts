import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

export function buildGateRejectedResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  status: "failed" | "review_required";
  failureReason: PostActionFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  inputDecision: string;
  payloadBudgetDecision: string;
  actionProofDecision: string;
  evidenceSourceDecision: string;
  observationBindingDecision: string;
  beforeAfterDecision: string;
  beforeAfterPairDecision: string;
  policyDecision: string;
  outputBoundaryDecision: string;
  criticalDataQualityDecision: string;
  verificationDecisionTrace: string[];
  dataQualityFlags: string[];
  diagnosticPayloadRef: string;
}) {
  const verificationDecision = input.status === "review_required" ? "review_required" : "failed";
  const runtimeProof = buildPostActionRuntimeProof({
    request: input.request,
    context: input.context,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    status: input.status,
    verificationDecision,
    confidence: 0,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    inputDecision: input.inputDecision,
    actionProofDecision: input.actionProofDecision,
    evidenceSourceDecision: input.evidenceSourceDecision,
    beforeAfterDecision: input.beforeAfterDecision,
    policyDecision: input.policyDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    criticalDataQualityDecision: input.criticalDataQualityDecision,
    observationBindingDecision: input.observationBindingDecision,
    beforeAfterPairDecision: input.beforeAfterPairDecision,
    verificationDecisionTrace: input.verificationDecisionTrace,
    dataQualityFlags: input.dataQualityFlags,
    inputRef: input.request.inputRef,
    outputRef: null,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
  });

  return buildPostActionVerificationResult({
    request: input.request,
    assessment: null,
    status: input.status,
    verificationDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    runtimeProof,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    dataQualityFlags: input.dataQualityFlags,
  });
}
