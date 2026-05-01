import { buildGateRejectedResult } from "./verification-gate-rejection-result.js";
import { validateActionProof } from "./action-proof-gate.js";
import { validateBeforeAfterConsistency } from "./before-after-consistency-gate.js";
import { validateEvidenceSources } from "./evidence-source-gate.js";
import { validateObservationProofBinding } from "./observation-proof-binding-gate.js";
import { validatePostActionPayloadBudget } from "./post-action-payload-budget-gate.js";
import { validatePostActionVerificationInput } from "./verification-input-gate.js";
import { validateVerificationPolicy } from "./verification-policy-gate.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

type VerificationClockMark = {
  isoTimestamp: string;
  monotonicMs: number;
};

export type PostActionVerificationGateSnapshot = {
  startedAt: string;
  startedMonotonicMs: number;
  diagnosticPayloadRef: string;
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
};

export type PostActionVerificationGateSequenceResult =
  | { ok: false; result: PostActionVerificationAbilityResult }
  | { ok: true; gateSnapshot: PostActionVerificationGateSnapshot };

const createVerificationGateSnapshot = (started: VerificationClockMark, diagnosticPayloadRef: string): PostActionVerificationGateSnapshot => ({
  startedAt: started.isoTimestamp,
  startedMonotonicMs: started.monotonicMs,
  diagnosticPayloadRef,
  inputDecision: "not_run",
  payloadBudgetDecision: "not_run",
  actionProofDecision: "not_run",
  evidenceSourceDecision: "not_run",
  observationBindingDecision: "not_run",
  beforeAfterDecision: "not_run",
  beforeAfterPairDecision: "not_run",
  policyDecision: "not_run",
  outputBoundaryDecision: "not_run",
  criticalDataQualityDecision: "not_run",
  verificationDecisionTrace: [],
  dataQualityFlags: [],
});

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

const failVerificationGate = (input: {
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

type VerificationGateStepInput = {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  started: VerificationClockMark;
  snapshot: PostActionVerificationGateSnapshot;
};

type VerificationGateStepResult = PostActionVerificationGateSequenceResult | null;

const runInputGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const inputGate = validatePostActionVerificationInput(input.request);
  if (inputGate.ok) {
    input.snapshot.inputDecision = inputGate.inputDecision;
    return null;
  }

  input.snapshot.inputDecision = inputGate.inputDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: inputGate.inputDecision,
    dataQualityFlags: inputGate.dataQualityFlags ?? [],
    status: inputGate.status ?? "failed",
    failureReason: inputGate.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: inputGate.reviewRequiredReason ?? null,
    statusMessage: inputGate.statusMessage ?? "Post Action Verification input gate rejected the request.",
  });
};

const runPayloadBudgetGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const payloadBudgetGate = validatePostActionPayloadBudget(input.request);
  if (payloadBudgetGate.ok) {
    input.snapshot.payloadBudgetDecision = payloadBudgetGate.payloadBudgetDecision;
    return null;
  }

  input.snapshot.payloadBudgetDecision = payloadBudgetGate.payloadBudgetDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: payloadBudgetGate.payloadBudgetDecision,
    dataQualityFlags: payloadBudgetGate.dataQualityFlags ?? [],
    status: payloadBudgetGate.status ?? "failed",
    failureReason: payloadBudgetGate.failureReason ?? "payload_budget_exceeded",
    reviewRequiredReason: payloadBudgetGate.reviewRequiredReason ?? null,
    statusMessage: payloadBudgetGate.statusMessage ?? "Payload budget gate rejected the request.",
  });
};

const runActionProofGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const actionProofGate = validateActionProof({ request: input.request, context: input.context });
  if (actionProofGate.ok) {
    input.snapshot.actionProofDecision = actionProofGate.actionProofDecision;
    return null;
  }

  input.snapshot.actionProofDecision = actionProofGate.actionProofDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: actionProofGate.actionProofDecision,
    dataQualityFlags: actionProofGate.dataQualityFlags ?? [],
    status: actionProofGate.status ?? "failed",
    failureReason: actionProofGate.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: actionProofGate.reviewRequiredReason ?? null,
    statusMessage: actionProofGate.statusMessage ?? "Action proof gate rejected the request.",
  });
};

const runEvidenceSourceGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const evidenceSourceGate = validateEvidenceSources({ request: input.request, nowIsoTimestamp: input.started.isoTimestamp });
  if (evidenceSourceGate.ok) {
    input.snapshot.evidenceSourceDecision = evidenceSourceGate.evidenceSourceDecision;
    return null;
  }

  input.snapshot.evidenceSourceDecision = evidenceSourceGate.evidenceSourceDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: evidenceSourceGate.evidenceSourceDecision,
    dataQualityFlags: evidenceSourceGate.dataQualityFlags ?? [],
    status: evidenceSourceGate.status ?? "failed",
    failureReason: evidenceSourceGate.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: evidenceSourceGate.reviewRequiredReason ?? null,
    statusMessage: evidenceSourceGate.statusMessage ?? "Evidence source gate rejected the request.",
  });
};

const runObservationBindingGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const observationBindingGate = validateObservationProofBinding({ request: input.request, context: input.context });
  if (observationBindingGate.ok) {
    input.snapshot.observationBindingDecision = observationBindingGate.observationBindingDecision;
    return null;
  }

  input.snapshot.observationBindingDecision = observationBindingGate.observationBindingDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: observationBindingGate.observationBindingDecision,
    dataQualityFlags: observationBindingGate.dataQualityFlags ?? [],
    status: observationBindingGate.status ?? "failed",
    failureReason: observationBindingGate.failureReason ?? "observation_binding_conflict",
    reviewRequiredReason: observationBindingGate.reviewRequiredReason ?? null,
    statusMessage: observationBindingGate.statusMessage ?? "Observation proof binding gate rejected the request.",
  });
};

const runBeforeAfterGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const beforeAfterGate = validateBeforeAfterConsistency(input.request);
  if (beforeAfterGate.ok) {
    input.snapshot.beforeAfterDecision = beforeAfterGate.beforeAfterDecision;
    input.snapshot.beforeAfterPairDecision = beforeAfterGate.beforeAfterPairDecision ?? "allow:before_after_pair_verified";
    return null;
  }

  input.snapshot.beforeAfterDecision = beforeAfterGate.beforeAfterDecision;
  input.snapshot.beforeAfterPairDecision = beforeAfterGate.beforeAfterPairDecision ?? "review_required:before_after_pair_rejected";
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: beforeAfterGate.beforeAfterDecision,
    dataQualityFlags: beforeAfterGate.dataQualityFlags ?? [],
    status: beforeAfterGate.status ?? "review_required",
    failureReason: beforeAfterGate.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: beforeAfterGate.reviewRequiredReason ?? null,
    statusMessage: beforeAfterGate.statusMessage ?? "Before/after gate rejected the request.",
  });
};

const runPolicyGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const policyGate = validateVerificationPolicy(input.request);
  if (policyGate.ok) {
    input.snapshot.policyDecision = policyGate.policyDecision;
    return null;
  }

  input.snapshot.policyDecision = policyGate.policyDecision;
  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    decision: policyGate.policyDecision,
    dataQualityFlags: policyGate.dataQualityFlags ?? [],
    status: policyGate.status ?? "failed",
    failureReason: policyGate.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: policyGate.reviewRequiredReason ?? null,
    statusMessage: policyGate.statusMessage ?? "Verification policy gate rejected the request.",
  });
};

export async function runPostActionVerificationGateSequence(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}): Promise<PostActionVerificationGateSequenceResult> {
  const started = input.context.clock.now();
  const snapshot = createVerificationGateSnapshot(started, `${input.request.inputRef}:diagnostic`);

  const gateSteps = [
    runInputGateStep,
    runPayloadBudgetGateStep,
    runActionProofGateStep,
    runEvidenceSourceGateStep,
    runObservationBindingGateStep,
    runBeforeAfterGateStep,
    runPolicyGateStep,
  ] as const;

  for (const gateStep of gateSteps) {
    const gateStepResult = gateStep({
      request: input.request,
      context: input.context,
      started,
      snapshot,
    });

    if (gateStepResult !== null) {
      return gateStepResult;
    }
  }

  return {
    ok: true as const,
    gateSnapshot: snapshot,
  };
}