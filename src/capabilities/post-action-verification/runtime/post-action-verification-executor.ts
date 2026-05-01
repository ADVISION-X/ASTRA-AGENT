import { completePostActionVerification } from "./verification-success-result.js";
import { runPostActionVerificationGateSequence } from "./verification-gate-sequence.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
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
    const gateSequence = await runPostActionVerificationGateSequence({
      request: input.request,
      context: input.context,
    });

    if (!gateSequence.ok) {
      return gateSequence.result;
    }

    const assessment = await input.capability.execute(input.request, input.context);
    const ended = input.context.clock.now();

    return completePostActionVerification({
      request: input.request,
      context: input.context,
      assessment,
      gateSnapshot: gateSequence.gateSnapshot,
      ended,
    });
  diagnosticPayloadRef: input.diagnosticPayloadRef,
      if (!policyGate.ok) {
        const ended = input.context.clock.now();
        return buildGateRejectedExecutionResult({ request: input.request, context: input.context, started, ended, status: policyGate.status ?? "failed", failureReason: policyGate.failureReason ?? "verification_execution_failed", reviewRequiredReason: policyGate.reviewRequiredReason ?? null, statusMessage: policyGate.statusMessage ?? "Verification policy gate rejected the request.", inputDecision: inputGate.inputDecision, payloadBudgetDecision: payloadBudgetGate.payloadBudgetDecision, actionProofDecision: actionProofGate.actionProofDecision, evidenceSourceDecision: evidenceSourceGate.evidenceSourceDecision, observationBindingDecision: observationBindingGate.observationBindingDecision, beforeAfterDecision: beforeAfterGate.beforeAfterDecision, beforeAfterPairDecision: beforeAfterGate.beforeAfterPairDecision, policyDecision: policyGate.policyDecision, outputBoundaryDecision: "not_run", criticalDataQualityDecision: "not_run", verificationDecisionTrace: [policyGate.policyDecision], dataQualityFlags: policyGate.dataQualityFlags ?? [], diagnosticPayloadRef });
