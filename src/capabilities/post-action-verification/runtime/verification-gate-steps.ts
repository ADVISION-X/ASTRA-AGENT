import { failVerificationGate } from "./verification-gate-failure.js";
import { validateActionProof } from "./action-proof-gate.js";
import { validateBeforeAfterConsistency } from "./before-after-consistency-gate.js";
import { validateEvidenceSources } from "./evidence-source-gate.js";
import { validateObservationProofBinding } from "./observation-proof-binding-gate.js";
import { validatePostActionPayloadBudget } from "./post-action-payload-budget-gate.js";
import { validatePostActionVerificationInput } from "./verification-input-gate.js";
import { validateVerificationPolicy } from "./verification-policy-gate.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import type { PostActionVerificationGateSequenceResult, PostActionVerificationGateSnapshot } from "./verification-gate-sequence.js";

type VerificationClockMark = {
  isoTimestamp: string;
  monotonicMs: number;
};

type VerificationGateStepInput = {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  started: VerificationClockMark;
  snapshot: PostActionVerificationGateSnapshot;
};

type VerificationGateStepResult = PostActionVerificationGateSequenceResult | null;

type GateFailureMetadata = {
  status?: "failed" | "review_required";
  failureReason?: PostActionFailureReason;
  reviewRequiredReason?: string | null;
  statusMessage?: string;
  dataQualityFlags?: string[];
};

const runInputGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const inputGate = validatePostActionVerificationInput(input.request);
  if (inputGate.ok) {
    input.snapshot.inputDecision = inputGate.inputDecision;
    return null;
  }

  const failure = inputGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.inputDecision = inputGate.inputDecision;
      input.snapshot.verificationDecisionTrace = [inputGate.inputDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Post Action Verification input gate rejected the request.",
  });
};

const runPayloadBudgetGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const payloadBudgetGate = validatePostActionPayloadBudget(input.request);
  if (payloadBudgetGate.ok) {
    input.snapshot.payloadBudgetDecision = payloadBudgetGate.payloadBudgetDecision;
    return null;
  }

  const failure = payloadBudgetGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.payloadBudgetDecision = payloadBudgetGate.payloadBudgetDecision;
      input.snapshot.verificationDecisionTrace = [payloadBudgetGate.payloadBudgetDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "payload_budget_exceeded",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Payload budget gate rejected the request.",
  });
};

const runActionProofGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const actionProofGate = validateActionProof({ request: input.request, context: input.context });
  if (actionProofGate.ok) {
    input.snapshot.actionProofDecision = actionProofGate.actionProofDecision;
    return null;
  }

  const failure = actionProofGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.actionProofDecision = actionProofGate.actionProofDecision;
      input.snapshot.verificationDecisionTrace = [actionProofGate.actionProofDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Action proof gate rejected the request.",
  });
};

const runEvidenceSourceGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const evidenceSourceGate = validateEvidenceSources({ request: input.request, nowIsoTimestamp: input.started.isoTimestamp });
  if (evidenceSourceGate.ok) {
    input.snapshot.evidenceSourceDecision = evidenceSourceGate.evidenceSourceDecision;
    return null;
  }

  const failure = evidenceSourceGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.evidenceSourceDecision = evidenceSourceGate.evidenceSourceDecision;
      input.snapshot.verificationDecisionTrace = [evidenceSourceGate.evidenceSourceDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Evidence source gate rejected the request.",
  });
};

const runObservationBindingGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const observationBindingGate = validateObservationProofBinding({ request: input.request, context: input.context });
  if (observationBindingGate.ok) {
    input.snapshot.observationBindingDecision = observationBindingGate.observationBindingDecision;
    return null;
  }

  const failure = observationBindingGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.observationBindingDecision = observationBindingGate.observationBindingDecision;
      input.snapshot.verificationDecisionTrace = [observationBindingGate.observationBindingDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "observation_binding_conflict",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Observation proof binding gate rejected the request.",
  });
};

const runBeforeAfterGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const beforeAfterGate = validateBeforeAfterConsistency(input.request);
  if (beforeAfterGate.ok) {
    input.snapshot.beforeAfterDecision = beforeAfterGate.beforeAfterDecision;
    input.snapshot.beforeAfterPairDecision = beforeAfterGate.beforeAfterPairDecision ?? "allow:before_after_pair_verified";
    return null;
  }

  const failure = beforeAfterGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.beforeAfterDecision = beforeAfterGate.beforeAfterDecision;
      input.snapshot.beforeAfterPairDecision = beforeAfterGate.beforeAfterPairDecision ?? "review_required:before_after_pair_rejected";
      input.snapshot.verificationDecisionTrace = [beforeAfterGate.beforeAfterDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "review_required",
    failureReason: failure.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Before/after gate rejected the request.",
  });
};

const runPolicyGateStep = (input: VerificationGateStepInput): VerificationGateStepResult => {
  const policyGate = validateVerificationPolicy(input.request);
  if (policyGate.ok) {
    input.snapshot.policyDecision = policyGate.policyDecision;
    return null;
  }

  const failure = policyGate as GateFailureMetadata;

  return failVerificationGate({
    request: input.request,
    context: input.context,
    started: input.started,
    snapshot: input.snapshot,
    applySnapshot: () => {
      input.snapshot.policyDecision = policyGate.policyDecision;
      input.snapshot.verificationDecisionTrace = [policyGate.policyDecision];
      input.snapshot.dataQualityFlags = failure.dataQualityFlags ?? [];
    },
    gate: failure,
    status: failure.status ?? "failed",
    failureReason: failure.failureReason ?? "verification_execution_failed",
    reviewRequiredReason: failure.reviewRequiredReason ?? null,
    statusMessage: failure.statusMessage ?? "Verification policy gate rejected the request.",
  });
};

export const POST_ACTION_VERIFICATION_GATE_STEPS = [
  runInputGateStep,
  runPayloadBudgetGateStep,
  runActionProofGateStep,
  runEvidenceSourceGateStep,
  runObservationBindingGateStep,
  runBeforeAfterGateStep,
  runPolicyGateStep,
] as const;