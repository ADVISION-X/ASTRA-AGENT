import { POST_ACTION_VERIFICATION_GATE_STEPS } from "./verification-gate-steps.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
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

export const createVerificationGateSnapshot = (started: VerificationClockMark, diagnosticPayloadRef: string): PostActionVerificationGateSnapshot => ({
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

export async function runPostActionVerificationGateSequence(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}): Promise<PostActionVerificationGateSequenceResult> {
  const started = input.context.clock.now();
  const snapshot = createVerificationGateSnapshot(started, `${input.request.inputRef}:diagnostic`);

  for (const gateStep of POST_ACTION_VERIFICATION_GATE_STEPS) {
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