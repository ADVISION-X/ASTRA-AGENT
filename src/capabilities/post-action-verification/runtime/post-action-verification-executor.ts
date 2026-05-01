import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import { finalizeVerificationDecision } from "./verification-decision-gate.js";
import { validateActionProof } from "./action-proof-gate.js";
import { validateBeforeAfterConsistency } from "./before-after-consistency-gate.js";
import { validateEvidenceSources } from "./evidence-source-gate.js";
import { validateObservationProofBinding } from "./observation-proof-binding-gate.js";
import { validatePostActionOutputBoundary } from "./post-action-output-boundary-gate.js";
import { validatePostActionPayloadBudget } from "./post-action-payload-budget-gate.js";
import { validatePostActionVerificationInput } from "./verification-input-gate.js";
import { buildGateRejectedResult } from "./verification-gate-rejection-result.js";
import { validateVerificationPolicy } from "./verification-policy-gate.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason } from "../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

const buildGateRejectedExecutionResult = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  started: { isoTimestamp: string; monotonicMs: number };
  ended: { isoTimestamp: string; monotonicMs: number };
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
}) => buildGateRejectedResult({
  request: input.request,
  context: input.context,
  startedAt: input.started.isoTimestamp,
  endedAt: input.ended.isoTimestamp,
  startedMonotonicMs: input.started.monotonicMs,
  endedMonotonicMs: input.ended.monotonicMs,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  inputDecision: input.inputDecision,
  payloadBudgetDecision: input.payloadBudgetDecision,
  actionProofDecision: input.actionProofDecision,
  evidenceSourceDecision: input.evidenceSourceDecision,
  observationBindingDecision: input.observationBindingDecision,
  beforeAfterDecision: input.beforeAfterDecision,
  beforeAfterPairDecision: input.beforeAfterPairDecision,
  policyDecision: input.policyDecision,
  outputBoundaryDecision: input.outputBoundaryDecision,
  criticalDataQualityDecision: input.criticalDataQualityDecision,
  verificationDecisionTrace: input.verificationDecisionTrace,
  dataQualityFlags: input.dataQualityFlags,
  diagnosticPayloadRef: input.diagnosticPayloadRef,
});

export async function executePostActionVerification(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  capability: PostActionVerificationChildCapability;
}) {
  const started = input.context.clock.now();
  const diagnosticPayloadRef = `${input.request.inputRef}:diagnostic`;

  const inputGate = validatePostActionVerificationInput(input.request);
  if (!inputGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: inputGate.status ?? "failed", failureReason: inputGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: inputGate.reviewRequiredReason ?? null, statusMessage: inputGate.statusMessage ?? "Post Action Verification input gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: "not_run", actionProofDecision: "not_run", evidenceSourceDecision: "not_run", observationBindingDecision: "not_run", beforeAfterDecision: "not_run", beforeAfterPairDecision: "not_run", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [inputGate.inputDecision], dataQualityFlags: inputGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const payloadBudgetGate = validatePostActionPayloadBudget(input.request);
  if (!payloadBudgetGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: payloadBudgetGate.status ?? "failed", failureReason: payloadBudgetGate.failureReason ?? "payload_budget_exceeded", reviewRequiredReason: payloadBudgetGate.reviewRequiredReason ?? null, statusMessage: payloadBudgetGate.statusMessage ?? "Payload budget gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: "not_run", evidenceSourceDecision: "not_run", observationBindingDecision: "not_run", beforeAfterDecision: "not_run", beforeAfterPairDecision: "not_run", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [payloadBudgetGate.payloadBudgetDecision], dataQualityFlags: payloadBudgetGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const actionProofGate = validateActionProof({ request: input.request, context: input.context });
  if (!actionProofGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: actionProofGate.status ?? "failed", failureReason: actionProofGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: actionProofGate.reviewRequiredReason ?? null, statusMessage: actionProofGate.statusMessage ?? "Action proof gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: "not_run", observationBindingDecision: "not_run", beforeAfterDecision: "not_run", beforeAfterPairDecision: "not_run", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [actionProofGate.actionProofDecision], dataQualityFlags: actionProofGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const evidenceSourceGate = validateEvidenceSources({
    request: input.request,
    nowIsoTimestamp: started.isoTimestamp,
  });
  if (!evidenceSourceGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: evidenceSourceGate.status ?? "failed", failureReason: evidenceSourceGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: evidenceSourceGate.reviewRequiredReason ?? null, statusMessage: evidenceSourceGate.statusMessage ?? "Evidence source gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision, observationBindingDecision: "not_run", beforeAfterDecision: "not_run", beforeAfterPairDecision: "not_run", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [evidenceSourceGate.evidenceSourceDecision], dataQualityFlags: evidenceSourceGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const observationBindingGate = validateObservationProofBinding({ request: input.request, context: input.context });
  if (!observationBindingGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: observationBindingGate.status ?? "failed", failureReason: observationBindingGate.failureReason ?? "observation_binding_conflict", reviewRequiredReason: observationBindingGate.reviewRequiredReason ?? null, statusMessage: observationBindingGate.statusMessage ?? "Observation proof binding gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision, observationBindingDecision: observationBindingGate.observationBindingDecision, beforeAfterDecision: "not_run", beforeAfterPairDecision: "not_run", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [observationBindingGate.observationBindingDecision], dataQualityFlags: observationBindingGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const beforeAfterGate = validateBeforeAfterConsistency(input.request);
  if (!beforeAfterGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: beforeAfterGate.status ?? "review_required", failureReason: beforeAfterGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: beforeAfterGate.reviewRequiredReason ?? null, statusMessage: beforeAfterGate.statusMessage ?? "Before/after gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision, observationBindingDecision: observationBindingGate.observationBindingDecision, beforeAfterDecision: beforeAfterGate.beforeAfterDecision, beforeAfterPairDecision: beforeAfterGate.beforeAfterPairDecision ?? "review_required:before_after_pair_rejected", policyDecision: "not_run", outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [beforeAfterGate.beforeAfterDecision], dataQualityFlags: beforeAfterGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const policyGate = validateVerificationPolicy(input.request);
  if (!policyGate.ok) {
    const ended = input.context.clock.now();
    return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: policyGate.status ?? "failed", failureReason: policyGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: policyGate.reviewRequiredReason ?? null, statusMessage: policyGate.statusMessage ?? "Verification policy gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision, observationBindingDecision: observationBindingGate.observationBindingDecision, beforeAfterDecision: beforeAfterGate.beforeAfterDecision, beforeAfterPairDecision: beforeAfterGate.beforeAfterPairDecision, policyDecision: policyGate.policyDecision, outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [policyGate.policyDecision], dataQualityFlags: policyGate.dataQualityFlags ?? [], diagnosticPayloadRef });
  }

  const assessment = await input.capability.execute(input.request, input.context);
  const outputBoundaryGate = validatePostActionOutputBoundary({ request: input.request, assessment });
  const finalDecision = finalizeVerificationDecision({ request: input.request, assessment, outputBoundaryGate });
  const ended = input.context.clock.now();
  const outputRef = finalDecision.status === "success"
    ? `${input.request.inputRef}:${input.request.childCapabilityId}:verified`
    : null;
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
    outputBoundaryDecision: outputBoundaryGate.outputBoundaryDecision,
    criticalDataQualityDecision: outputBoundaryGate.criticalDataQualityDecision,
    observationBindingDecision: observationBindingGate.observationBindingDecision,
    beforeAfterPairDecision: beforeAfterGate.beforeAfterPairDecision,
    verificationDecisionTrace: finalDecision.verificationDecisionTrace,
    dataQualityFlags: finalDecision.dataQualityFlags,
    inputRef: input.request.inputRef,
    outputRef,
    diagnosticPayloadRef: outputRef === null ? diagnosticPayloadRef : null,
  });

  return buildPostActionVerificationResult({
    request: input.request,
    assessment,
    status: finalDecision.status,
    verificationDecision: finalDecision.verificationDecision,
    failureReason: finalDecision.failureReason,
    reviewRequiredReason: finalDecision.reviewRequiredReason,
    statusMessage: finalDecision.statusMessage,
    runtimeProof,
    diagnosticPayloadRef: outputRef === null ? diagnosticPayloadRef : null,
    dataQualityFlags: finalDecision.dataQualityFlags,
  });
}
