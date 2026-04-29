import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import { finalizeVerificationDecision } from "./verification-decision-gate.js";
import { validateActionProof } from "./action-proof-gate.js";
import { validateBeforeAfterConsistency } from "./before-after-consistency-gate.js";
import { validateEvidenceSources } from "./evidence-source-gate.js";
import { validatePostActionVerificationInput } from "./verification-input-gate.js";
import { validateVerificationPolicy } from "./verification-policy-gate.js";
import type {
  ParsedPostActionVerificationAbilityInput,
  PostActionFailureReason,
  PostActionVerificationAbilityContext,
  PostActionVerificationChildCapability,
} from "../contract.js";

function buildGateRejectedResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationAbilityContext;
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  status: "failed" | "review_required" | "blocked";
  failureReason: PostActionFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  observedOutcome: string;
  inputDecision: string;
  actionProofDecision: string;
  evidenceSourceDecision: string;
  beforeAfterDecision: string;
  policyDecision: string;
  verificationDecisionTrace: string;
  dataQualityFlags: string[];
}) {
  const verificationDecision = input.status === "blocked" ? "blocked" : input.status === "review_required" ? "review_required" : "failed";
  const outputRef = `${input.request.inputRef}:rejected`;
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
    verificationDecisionTrace: input.verificationDecisionTrace,
    dataQualityFlags: input.dataQualityFlags,
    inputRef: input.request.inputRef,
    outputRef,
  });

  return buildPostActionVerificationResult({
    request: input.request,
    observedOutcome: input.observedOutcome,
    confidence: 0,
    status: input.status,
    verificationDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    runtimeProof,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function executePostActionVerification(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationAbilityContext;
  capability: PostActionVerificationChildCapability;
}) {
  const started = input.context.clock.now();

  const inputGate = validatePostActionVerificationInput(input.request);
  if (!inputGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedResult({
      request: input.request,
      context: input.context,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      status: inputGate.status ?? "blocked",
      failureReason: inputGate.failureReason ?? "verification_execution_failed",
      reviewRequiredReason: inputGate.reviewRequiredReason ?? null,
      statusMessage: inputGate.statusMessage ?? "Post Action Verification input gate rejected the request.",
      observedOutcome: "input_rejected",
      inputDecision: inputGate.inputDecision,
      actionProofDecision: "not_run",
      evidenceSourceDecision: "not_run",
      beforeAfterDecision: "not_run",
      policyDecision: "not_run",
      verificationDecisionTrace: inputGate.inputDecision,
      dataQualityFlags: inputGate.dataQualityFlags ?? [],
    });
  }

  const actionProofGate = validateActionProof(input.request);
  if (!actionProofGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedResult({
      request: input.request,
      context: input.context,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      status: actionProofGate.status ?? "blocked",
      failureReason: actionProofGate.failureReason ?? "verification_execution_failed",
      reviewRequiredReason: actionProofGate.reviewRequiredReason ?? null,
      statusMessage: actionProofGate.statusMessage ?? "Action proof gate rejected the request.",
      observedOutcome: "action_proof_rejected",
      inputDecision: inputGate.inputDecision,
      actionProofDecision: actionProofGate.actionProofDecision,
      evidenceSourceDecision: "not_run",
      beforeAfterDecision: "not_run",
      policyDecision: "not_run",
      verificationDecisionTrace: actionProofGate.actionProofDecision,
      dataQualityFlags: actionProofGate.dataQualityFlags ?? [],
    });
  }

  const evidenceSourceGate = validateEvidenceSources({
    request: input.request,
    nowIsoTimestamp: started.isoTimestamp,
  });
  if (!evidenceSourceGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedResult({
      request: input.request,
      context: input.context,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      status: evidenceSourceGate.status ?? "blocked",
      failureReason: evidenceSourceGate.failureReason ?? "verification_execution_failed",
      reviewRequiredReason: evidenceSourceGate.reviewRequiredReason ?? null,
      statusMessage: evidenceSourceGate.statusMessage ?? "Evidence source gate rejected the request.",
      observedOutcome: "evidence_source_rejected",
      inputDecision: inputGate.inputDecision,
      actionProofDecision: actionProofGate.actionProofDecision,
      evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision,
      beforeAfterDecision: "not_run",
      policyDecision: "not_run",
      verificationDecisionTrace: evidenceSourceGate.evidenceSourceDecision,
      dataQualityFlags: evidenceSourceGate.dataQualityFlags ?? [],
    });
  }

  const beforeAfterGate = validateBeforeAfterConsistency(input.request);
  if (!beforeAfterGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedResult({
      request: input.request,
      context: input.context,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      status: beforeAfterGate.status ?? "review_required",
      failureReason: beforeAfterGate.failureReason ?? "verification_execution_failed",
      reviewRequiredReason: beforeAfterGate.reviewRequiredReason ?? null,
      statusMessage: beforeAfterGate.statusMessage ?? "Before/after gate rejected the request.",
      observedOutcome: "before_after_rejected",
      inputDecision: inputGate.inputDecision,
      actionProofDecision: actionProofGate.actionProofDecision,
      evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision,
      beforeAfterDecision: beforeAfterGate.beforeAfterDecision,
      policyDecision: "not_run",
      verificationDecisionTrace: beforeAfterGate.beforeAfterDecision,
      dataQualityFlags: beforeAfterGate.dataQualityFlags ?? [],
    });
  }

  const policyGate = validateVerificationPolicy(input.request);
  if (!policyGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedResult({
      request: input.request,
      context: input.context,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      status: policyGate.status ?? "blocked",
      failureReason: policyGate.failureReason ?? "verification_execution_failed",
      reviewRequiredReason: policyGate.reviewRequiredReason ?? null,
      statusMessage: policyGate.statusMessage ?? "Verification policy gate rejected the request.",
      observedOutcome: "policy_rejected",
      inputDecision: inputGate.inputDecision,
      actionProofDecision: actionProofGate.actionProofDecision,
      evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision,
      beforeAfterDecision: beforeAfterGate.beforeAfterDecision,
      policyDecision: policyGate.policyDecision,
      verificationDecisionTrace: policyGate.policyDecision,
      dataQualityFlags: policyGate.dataQualityFlags ?? [],
    });
  }

  const assessment = await input.capability.execute(input.request, input.context);
  const finalDecision = finalizeVerificationDecision({ request: input.request, assessment });
  const ended = input.context.clock.now();
  const outputRef = `${input.request.inputRef}:${input.request.childCapabilityId}:${finalDecision.status}`;
  const runtimeProof = buildPostActionRuntimeProof({
    request: input.request,
    context: input.context,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    status: finalDecision.status,
    verificationDecision: finalDecision.verificationDecision,
    confidence: finalDecision.confidence,
    failureReason: finalDecision.failureReason,
    reviewRequiredReason: finalDecision.reviewRequiredReason,
    inputDecision: inputGate.inputDecision,
    actionProofDecision: actionProofGate.actionProofDecision,
    evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision,
    beforeAfterDecision: beforeAfterGate.beforeAfterDecision,
    policyDecision: policyGate.policyDecision,
    verificationDecisionTrace: finalDecision.verificationDecisionTrace,
    dataQualityFlags: finalDecision.dataQualityFlags,
    inputRef: input.request.inputRef,
    outputRef,
  });

  return buildPostActionVerificationResult({
    request: input.request,
    observedOutcome: assessment.observedOutcome,
    confidence: finalDecision.confidence,
    status: finalDecision.status,
    verificationDecision: finalDecision.verificationDecision,
    failureReason: finalDecision.failureReason,
    reviewRequiredReason: finalDecision.reviewRequiredReason,
    statusMessage: finalDecision.statusMessage,
    runtimeProof,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    dataQualityFlags: finalDecision.dataQualityFlags,
  });
}
