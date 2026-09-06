import { createHash } from "node:crypto";

import type { BrowserAtomicStepRecovery, BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptExactCallIdentityHash,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
  type GptHash,
} from "./contract.js";

const sha256 = (value: string): GptHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type RecoveryResultInput = Readonly<{
  intent: GptAnyChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  recovery: BrowserAtomicStepRecovery;
  state: "confirmed" | "rejected" | "dispatched";
}>;

const recoveredProof = (input: RecoveryResultInput): GptChildCapabilityProof => {
  const timestamp = new Date().toISOString();
  const exactCallIdentityHash = gptExactCallIdentityHash(input.intent);
  const targetRefHash = sha256(input.browser.target.targetRef);
  const documentRefHash = sha256(input.browser.document.documentRef);
  const effectScope = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].replayPolicy
    === "provider-effect-once" ? "provider_effect" as const : "target_local" as const;
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: input.intent.childCapabilityId,
    childContractVersion: GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].contractVersion,
    childStatus: input.state === "confirmed" ? "success" as const : "failed" as const,
    childReasonCode: input.state === "confirmed" ? "GPT_CHILD_SUCCESS"
      : input.state === "rejected" ? input.recovery.failureCode ?? "BROWSER_POSTCONDITION_FAILED"
        : input.readback?.failureCode ?? "BROWSER_COMMAND_RECEIPT_MISSING",
    exactCallIdentityHash,
    internalDecisionCode: input.state === "confirmed" ? "DONE" as const : "FAIL_CLOSED" as const,
    executionId: input.intent.executionId,
    jobId: input.intent.jobId,
    attemptId: input.intent.attemptId,
    pluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    productStepId: input.intent.productStepId,
    callId: input.intent.callId,
    inputHash: input.intent.inputHash,
    actionOrdinal: input.intent.actionOrdinal,
    targetRefHash,
    beforeDocumentRefHash: documentRefHash,
    afterDocumentRefHash: documentRefHash,
    authorityRefHashes: Object.freeze([targetRefHash, documentRefHash, input.recovery.authorityHash]),
    factResultIds: Object.freeze([input.recovery.authorityRef]),
    candidateCardinality: input.readback?.proof.candidateCardinality
      ?? Object.freeze({ raw: null, eligible: null }),
    observationRevisionHash: input.readback?.proof.observationRevisionHash ?? null,
    committedMutation: input.recovery.mutationOutcome,
    postconditionResult: input.state === "confirmed" ? "passed" as const
      : input.state === "dispatched" ? "pending" as const : "failed" as const,
    browserFact: Object.freeze({
      exactCallIdentityHash,
      childCapabilityId: input.intent.childCapabilityId,
      effectScope,
      browserOutcome: input.state.toUpperCase() as "DISPATCHED" | "CONFIRMED" | "REJECTED",
      mutationOutcome: input.recovery.mutationOutcome,
      terminalAt: input.recovery.terminalAt,
      evidenceRef: input.recovery.authorityRef,
      evidenceHash: input.recovery.authorityHash,
    }),
    nativeFailureCode: input.state === "rejected"
      ? input.recovery.nativeFailureCode : input.readback?.proof.nativeFailureCode ?? null,
    startedAt: input.readback?.proof.startedAt ?? timestamp,
    endedAt: input.readback?.proof.endedAt ?? timestamp,
  };
  const evidenceHash = sha256(JSON.stringify(unsigned));
  return Object.freeze({ ...unsigned, evidenceRef: input.recovery.authorityRef, evidenceHash });
};

export const recoveredGptChildResult = (input: RecoveryResultInput): GptChildCapabilityResult => {
  const proof = recoveredProof(input);
  if (input.state === "confirmed") {
    if (input.readback?.status !== "success") {
      throw executionFailure("failed", "BROWSER_CONFIRMED_READBACK_MISSING");
    }
    return Object.freeze({
      status: "success", value: input.readback.value, proof, failureCode: null,
      failureCause: null, failureBrowserEffect: null,
      reasoningRequirementResult: input.readback.reasoningRequirementResult,
    });
  }
  if (input.state === "dispatched" && input.readback?.status !== "failed") {
    throw executionFailure("failed", "BROWSER_DISPATCHED_READBACK_FAILURE_REQUIRED");
  }
  const failureCode = input.state === "dispatched"
    ? input.readback?.failureCode : input.recovery.failureCode;
  if (!failureCode) throw executionFailure("failed", "BROWSER_RECOVERY_FAILURE_CODE_REQUIRED");
  return Object.freeze({
    status: "failed", value: null, proof, failureCode,
    failureCause: input.state === "dispatched"
      ? input.readback!.failureCause
      : Object.freeze({ name: "Error", code: input.recovery.nativeFailureCode }),
    failureBrowserEffect: Object.freeze({
      effectScope: GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].replayPolicy
        === "provider-effect-once" ? "provider_effect" as const : "target_local" as const,
      childCapabilityId: input.intent.childCapabilityId,
      browserOutcome: input.state === "dispatched" ? "DISPATCHED" as const : "REJECTED" as const,
    }),
    reasoningRequirementResult: input.readback?.reasoningRequirementResult ?? null,
  });
};
